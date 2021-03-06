/*
 * Copyright 2014 mpowers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(function(window, undefined) {

	/*
	 * Model manages the trsst data model: at this time we're calling to an
	 * embedded local web service to handle the heavy lifting, but other/future
	 * implementations will handle all of these services in pure js.
	 */

	var model = window.model = {};
	var subscribers = [];
	var pathArray = window.location.href.split('/');
	protocol = pathArray[0];
	host = pathArray[2];
	model.serverUrl = protocol + '//' + host;
	var defaultBase = "/feed";

	var accounts;
	var authenticatedUid;
	var authenticatedFollows;

	/*
	 * Yep, this is the user's password in cleartext. No point in hiding it; if
	 * you can get this far, you've gotten control of the user's browser and
	 * obfuscation wouldn't have stopped you anyway. In the future we'll ask the
	 * user if they want us to retain their password ("keep me logged in") or
	 * whether they want to type it each time they do anything.
	 */
	var authenticatedPwd;

	var pushFeed = function(feedId, password, formData, callback) {
		if (feedId) {
			formData.append("id", feedId);
		}
		if (password) {
			formData.append("pass", password);
		}
		$.ajax({
			url : "/post",
			data : formData,
			processData : false,
			contentType : false,
			type : 'POST',
			success : function(data) {
				authenticatedUid = $(data).children("id").text();
				authenticatedPwd = password;
				authenticatedFollows = {};
				model.getFollowsForFeedId(authenticatedUid, function(ids) {
					for ( var id in ids) {
						// used only for hash lookups
						authenticatedFollows[ids[id]] = ids[id];
					}
					callback($(data));
					model.notify(feedId);
				});
			},
			error : function(e) {
				console.log("Error: error while posting:");
				console.log(e);
				callback(null);
			}
		});
	};

	/**
	 * Subscribe with a callback to receive a feedId whose content may need to
	 * be refreshed.
	 */
	model.subscribe = function(callback) {
		subscribers.push(callback);
	};

	/**
	 * Called to notify observers object did change on a later event.
	 */
	model.notify = function(feedId) {
		if (notifyQueue.indexOf(feedId) === -1) {
			notifyQueue.push(feedId);
			if (notifyTimer) {
				window.clearTimeout(notifyTimer);
			}
			notifyTimer = window.setTimeout(function() {
				notifyTimer = null;
				for ( var id in notifyQueue) {
					for ( var i in subscribers) {
						subscribers[i](notifyQueue[id]);
					}
				}
				notifyQueue = [];
			}, 500);
		}
	};
	var notifyTimer;
	var notifyQueue = [];

	var shallowCopy = function(obj) {
		var result = {};
		for ( var i in obj) {
			result[i] = obj[i];
		}
		return result;
	};

	/**
	 * Attempts to authenticate the specified id and password, calling callback
	 * with feedData on success, or null on failure.
	 */
	model.signIn = function(feedId, password, callback) {
		pushFeed(feedId, password, new FormData(), callback);
	};

	/**
	 * Clears current login credentials.
	 */
	model.signOut = function() {
		authenticatedUid = null;
		authenticatedPwd = null;
		authenticatedFollows = null;
	};

	/**
	 * Deletes the specified entry.
	 */
	model.deleteEntry = function(entryId) {
		if (authenticatedUid) {
			var formData = new FormData();
			formData.append("verb", "delete");
			// mention the deleted entry
			formData.append("mention", entryId);
			// servers will do the rest
			pushFeed(authenticatedUid, authenticatedPwd, formData, function(feedData) {
				console.log("Deleted entry: " + entryId);
			});
		}
	};

	/**
	 * Reposts the specified entry.
	 */
	model.repostEntry = function(entryId) {
		if (authenticatedUid) {
			var formData = new FormData();
			formData.append("verb", "repost");
			// linked to the followed feed
			formData.append("url", entryId);
			// normally we want the poster to know about it
			formData.append("mention", entryId);
			pushFeed(authenticatedUid, authenticatedPwd, formData, function(feedData) {
				console.log("Reposted: " + entryId);
				model.notify(feedIdFromEntryId(entryId));
			});
		}
	};

	/**
	 * Deletes any reposts of the specified entry.
	 */
	model.unrepostEntry = function(entryId) {
		if (authenticatedUid) {
			model.pull({
				feedId : feedIdFromEntryId(entryId),
				verb : "repost",
				mention : entryId
			}, function(feedData) {
				$(feedData).find("entry id").each(function() {
					deleteEntry($(this).text());
				});
			});
		}
	};

	/**
	 * "Likes" or "favorites" the specified entry.
	 */
	model.likeEntry = function(entryId) {
		if (authenticatedUid) {
			var formData = new FormData();
			formData.append("verb", "like");
			// linked to the followed feed
			formData.append("url", entryId);
			// normally we want the poster to know about it
			formData.append("mention", entryId);
			pushFeed(authenticatedUid, authenticatedPwd, formData, function(feedData) {
				console.log("Liked: " + entryId);
				model.notify(feedIdFromEntryId(entryId));
			});
		}
	};

	/**
	 * Deletes any reposts of the specified entry.
	 */
	model.unlikeEntry = function(entryId) {
		if (authenticatedUid) {
			model.pull({
				feedId : feedIdFromEntryId(entryId),
				verb : "like",
				mention : entryId
			}, function(feedData) {
				$(feedData).find("entry id").each(function() {
					deleteEntry($(this).text());
				});
			});
		}
	};

	var feedIdFromEntryId = function(entryId) {
		var result = entryId;
		if (entryId.indexOf("urn:entry:") === 0) {
			result = result.substring("urn:entry:");
		}
		var index = result.indexOf(":");
		if (index !== -1) {
			result = result.substring(0, index);
		}
		return result;
	};

	/**
	 * Follows the specified feed.
	 */
	model.followFeed = function(feedId) {
		if (authenticatedUid) {
			if (!model.isAuthenticatedFollowing(feedId)) {
				var formData = new FormData();
				formData.append("verb", "follow");
				// linked to the followed feed
				formData.append("url", feedId);
				// normally we want the followed to know about it
				formData.append("mention", feedId);
				pushFeed(authenticatedUid, authenticatedPwd, formData, function(feedData) {
					console.log("Following: " + feedId);
					model.notify(feedId);
				});
			}
		}
	};

	/**
	 * Unfollows the specified feed: deletes the original follow entry.
	 */
	model.unfollowFeed = function(feedId) {
		if (authenticatedUid) {
			if (model.isAuthenticatedFollowing(feedId)) {
				fetchFilterWithSelector({
					feedId : authenticatedUid,
					verb : "follow"
				}, "feed content[src='" + feedId + "']", function(results) {
					if (results && results.length > 0) {
						model.deleteEntry($(results[0]).closest("entry").children("id").text());
						console.log("Unfollowed: " + feedId);
						if (results.length > 1) {
							console.log("Found multple follow entries: deleted first:" + feedId);
							console.log(results);
						}
						model.notify(feedId);
					} else {
						console.log("Could not find follow to delete: " + feedId);
					}
				});
			}
		}
	};

	/**
	 * Updates the currently authenticated feed with fields in the specified
	 * form data (including file uploads).
	 */
	model.updateFeed = function(formData, callback) {
		pushFeed(authenticatedUid, authenticatedPwd, formData, callback);
	};

	/**
	 * Creates an account with the specified password, calling callback with
	 * feedData on success, or null on failure.
	 */
	model.authenticateNewAccount = function(password, callback) {
		pushFeed(null, password, new FormData(), callback);
	};

	/**
	 * Returns the default feed base for fetched feeds. Use this to resolve
	 * relative content urls unless the feed element has an xml:base attribute.
	 */
	model.getDefaultFeedBase = function() {
		return defaultBase;
	};

	/**
	 * Returns the currently authenticated account id, or null if none.
	 */
	model.getAuthenticatedAccountId = function() {
		if (authenticatedUid && authenticatedPwd) {
			return authenticatedUid;
		}
		return null;
	};

	/**
	 * Returns an array of currently subscribed feed ids, or null if no
	 * authenticated account.
	 */
	model.getAuthenticatedFollows = function() {
		if (authenticatedFollows) {
			var results = [];
			for ( var result in authenticatedFollows) {
				results.push(authenticatedFollows[result]);
			}
			return results;
		}
		return null;
	};

	/**
	 * Returns whether the current account is following the specified feed id.
	 */
	model.isAuthenticatedFollowing = function(feedId) {
		if (authenticatedFollows) {
			if (authenticatedFollows[feedId]) {
				return true;
			}
		}
		return false;
	};

	/**
	 * Calls callback with an array of feed ids that the specified feed id
	 * follows.
	 */
	model.getFollowsForFeedId = function(id, callback) {
		fetchFilterWithSelector({
			feedId : id,
			verb : "follow"
		}, "feed content", function(results) {
			for ( var i in results) {
				results[i] = $(results[i]).attr("src");
			}
			callback(results);
		});
	};

	/**
	 * Fetches all pages of results for the filter, and calls callback with an
	 * array of objects specified by the selector.
	 */
	var fetchFilterWithSelector = function(filter, selector, callback) {
		var results = [];
		model.pull(filter, function(feedData) {
			// final call
			if (feedData) {
				$(feedData).find(selector).each(function() {
					results.push(this);
				});
				callback(results);
				// exit
				return true;
			}
			// error: halt
			console.log("fetchFilterWithSelector: call failed with final result: ");
			console.log(results);
			return false;
		}, function(feedData) {
			// partial callback
			if (feedData) {
				$(feedData).find(selector).each(function() {
					results.push(this);
				});
				// return more if any
				return true;
			}
			// error: halt
			console.log("fetchFilterWithSelector: call failed with partial result: ");
			console.log(results);
			return false;
		});
	};

	/**
	 * Pull local user accounts from local server: calls callback with an array
	 * of feed UI elements
	 */
	model.getAccounts = function(callback) {
		if (!accounts) {
			accounts = [];
			$.ajax({
				// fetch service document
				url : defaultBase + '/service',
				success : function(data) {
					$(data).find("collection").each(function() {
						// relative hrefs are not in urn form
						accounts.push("urn:feed:" + this.getAttribute("href"));
					});
					callback(accounts);
				},
				error : function(e) {
					console.log("Error: could not load accounts:");
					console.log(e);
				}
			});
		} else {
			callback(accounts);
		}
	};

	/**
	 * Calls callback with feed data element containing any entry elements that
	 * match the filter options for the specified feed id. The callback is
	 * called for each page of results; if the call returns true, it will get
	 * called again with the next page of results. If callbackPartial is
	 * specified, it will get called instead of callback for each page of
	 * results except the last page.
	 */
	model.pull = function(filterObject, callback, callbackPartial) {
		// FIXME: we get called a lot of times with the same query
		// so we need to start caching sooner than later
		filterObject = shallowCopy(filterObject);
		// if we're logged in
		if (authenticatedUid) {
			// decrypt entries
			filterObject.decrypt = authenticatedUid;
			filterObject.pass = authenticatedPwd;
		}
		var path = filterObject.feedId;
		if (path) {
			delete filterObject.feedId;
			i = path.indexOf("urn:feed:");
			if (i === 0) {
				path = path.substring("urn:feed:".length);
			}
			if (filterObject.entryId) {
				path = path + '/' + controller.entryIdFromEntryUrn(filterObject.entryId);
				delete filterObject.entryId;
			}
		} else {
			path = ""; // no feed filter
		}
		// !! recursiveAjax(defaultBase + '/' + path, filterObject, callback,
		// callbackPartial);
		recursiveAjax('/pull/' + path, filterObject, callback, callbackPartial);
	};

	var recursiveAjax = function(url, filterObject, callback, callbackPartial) {
		$.ajax({
			url : url,
			data : filterObject,
			success : function(data) {
				var feedData = $(data).find("feed").first();
				// handle pagination
				var next = feedData.children("link[rel='next']").first().attr("href");
				// if there's a next page
				if (next) {
					var proceed;
					if (callbackPartial) {
						// if client accepts partial updates
						// mark this result as such
						proceed = callbackPartial(feedData);
					} else {
						// otherwise just call the main
						// callback multiple times
						proceed = callback(feedData);
					}
					// if callbacks want us to continue
					if (proceed) {
						// call for the next page
						recursiveAjax(next, null, callback, callbackPartial);
						// filter options are already baked into the url
					}
				} else {
					// we're done
					callback(feedData);
				}
			},
			error : function(e) {
				// error: we're done
				callback(null);
				console.log("Error: could not load url: " + url);
				console.log(e);
			}
		});
	};

	model.resolveUrl = function(url, element) {
		var base;
		// if there's an element to resolve
		if (url && element) {
			// if not an external reference
			if (url.indexOf("http") !== 0) {
				// if not an absolute reference
				if (url.indexOf('/') !== 0) {
					// walk this and parents in reverse order
					$($(element).parents("[xml\\:base]").add(element).get().reverse()).each(function() {
						base = $(this).attr("xml:base");
						if (base) {
							if (base.charAt(base.length - 1) == '/') {
								// strip trailing slash if any
								base = base.substring(0, base.length - 1);
							}
							url = base + '/' + url;
						}
					});
				}
			}

			// if not an external reference
			if (url.indexOf("http") !== 0) {
				// if not an absolute reference
				if (url.indexOf('/') !== 0) {
					// prepend feed id
					var id = $(element).closest("feed").children("id").text();
					if (id) {
						id = id.substring("feed:urn:".length);
						url = id + '/' + url;
					}
					// prepend default feed base
					url = defaultBase + '/' + url;
				}
			}
		}

		return url;
	};

})(window);
