/*!
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

	var controller = window.controller = {};
	var entryTemplate = document.getElementById('entryTemplate');
	$(entryTemplate).remove();
	var feedTemplate = document.getElementById('feedTemplate');
	$(feedTemplate).remove();
	var feedEditTemplate = document.getElementById('feedEditTemplate');
	$(feedEditTemplate).remove();
	var passwordVerifyTemplate = document.getElementById('passwordVerifyTemplate');
	$(passwordVerifyTemplate).remove();
	var passwordCreateTemplate = document.getElementById('passwordCreateTemplate');
	$(passwordCreateTemplate).remove();

	var createElementForFeedData = function(feedData) {

		// clone feed template
		var feedElement = $(feedTemplate).clone();
		var feedId = feedData.children("id").text();
		if (feedId.indexOf("urn:feed:http") > -1) {
			feedElement.addClass("external");
		}

		feedElement.attr("feed", feedId);
		feedElement.removeAttr("id");
		feedElement.find(".title span").text(feedData.children("title").text());
		if (feedData.children("title").text().length === 0) {
			feedElement.find(".title").addClass("empty-text"); // hint for css
		}
		feedElement.find(".subtitle span").text(feedData.children("subtitle").text());
		if (feedData.children("subtitle").text().length === 0) {
			feedElement.find(".subtitle").addClass("empty-text"); // hint for
			// css
		}
		feedElement.find(".feed-id span").text(feedData.children("id").text().substring("urn:feed:".length));
		feedElement.find(".author-name span").text(feedData.children("author>name").text());
		feedElement.find(".author-email span").text(feedData.children("author>email").text());
		feedElement.find(".author-uri span").text(feedData.children("author>uri").text());
		feedElement.find(".author-uri a").attr("href", feedData.children("author>uri").text());

		// logo (backdrop)
		var logoSrc = feedData.find("logo").text();
		if (logoSrc) {
			feedElement.find(".logo img").attr("src", iconSrc);
		}

		// icon (profile pic)
		var iconSrc = computeMakeshiftIcon(feedData);
		if (iconSrc) {
			feedElement.find(".icon").last().css("background-image", "url('" + iconSrc + "')");
			// some styles may choose to hide the foreground img
			// $(feedElement).find(".icon img").attr("src", iconSrc);
		}

		// mark with signed status
		if (feedData.children().find("Signature")) {
			// TODO: model needs to validate signature for us
			// TODO: for now mark as signed to test the ui
			feedElement.addClass("content-signed");
		}

		// handling for follow button
		var followElement = feedElement.find(".follow");
		if (model.isAuthenticatedFollowing(feedId)) {
			followElement.addClass("following");
		} else {
			followElement.removeClass("following");
		}
		var followButton = followElement.find("button");
		followButton.attr("disabled", false);
		followButton.click(function(e) {
			followButton.attr("disabled", true);
			if (followElement.hasClass("following")) {
				model.unfollowFeed(feedId);
			} else {
				model.followFeed(feedId);
			}
		});

		// enable clickable anchors
		feedElement.find("a").click(function(event) {
			var url = $(event.target).closest("a").attr("src");
			if (!url) {
				// if not specified open as internal link
				event.preventDefault();
				url = $(event.target).closest('.feed').attr("feed");
				if (url.indexOf("urn:feed:") === 0) {
					url = url.substring("urn:feed:".length);
				}
				if (url) {
					window.history.pushState(null, null, "/" + url);
					onPopulate();
				} else {
					console.log("Feed click: could not determine destination");
					console.log(event);
				}
			}
		});

		return feedElement;
	};

	var computeMakeshiftIcon = function(feedData) {
		var feedId = feedData.children("id").text();
		var iconSrc = feedData.children("icon").last().text();
		if (iconSrc) {
			iconSrc = model.resolveUrl(iconSrc, feedData.children("icon").last());
		}
		if (!iconSrc && feedId.indexOf("urn:feed:http") === 0) {
			// no icon specified: try an apple touch icon
			var i = feedId.indexOf("//");
			var host = feedId.substring(i + 2);
			i = host.indexOf("/");
			if (i !== -1) {
				host = host.substring(0, i);
			}
			// strip only first host name
			i = host.indexOf(".");
			if (host.substring(i + 1).indexOf(".") != -1) {
				host = host.substring(i + 1);
			}
			iconSrc = 'http://' + host + "/apple-touch-icon.png";
		}
		return iconSrc;
	};

	var createElementForEntryData = function(feedData, entryData) {
		feedData = $(feedData);
		entryData = $(entryData);

		// if encrypted content
		var contentEncryption;
		if ("application/xenc+xml" === entryData.find("content").first().attr("type")) {
			// grab the unencrypted payload (if any)
			var entryPayload = entryData.find("content entry");
			if (entryPayload.length > 0) {
				// replace envelope with payload
				entryData = entryPayload.first();
				contentEncryption = "content-decrypted";
			} else {
				// treat this as an "encrypted" verb
				contentEncryption = "content-encrypted";
			}
		}

		// clone entry template
		var entryElement = $(entryTemplate).clone();
		var entryId = entryData.find("id").text();
		if (entryId.indexOf("urn:entry:http") > -1) {
			entryElement.addClass("external");
		}
		entryElement.attr("entry", entryId);
		entryElement.removeAttr("id");

		// mark with encryption status
		if (contentEncryption) {
			entryElement.addClass(contentEncryption);
		}

		// mark with verb
		var verb = entryData.find("verb").text();
		if (verb) {
			entryElement.addClass("verb-" + verb);
		}

		// mark with signed status
		if (entryData.children().find("Signature")) {
			// TODO: model needs to validate signature for us
			// TODO: for now mark as signed to test the ui
			entryElement.addClass("content-signed");
		}

		// populate template
		var elementUI;
		var elementData;

		// icon (profile pic)
		var iconSrc = computeMakeshiftIcon(feedData);
		if (iconSrc) {
			// if icon is specified
			entryElement.find(".icon").last().css("background-image", "url('" + iconSrc + "')");
			// some styles may choose to hide the foreground
			// img
			// entryElement.find(".icon
			// img").attr("src", iconSrc);
		}

		entryElement.find(".feed-title span").text(feedData.children("title").text());
		if (feedData.children("title").text().length === 0) {
			// hint for css layout
			entryElement.find(".feed-title").addClass("empty-text");
		}
		entryElement.find(".feed-id span").text(feedData.children("id").text().substring("urn:feed:".length));
		entryElement.find(".title span").text(entryData.find("title").text());

		// summary: sandboxed iframe
		var summary = entryData.find("summary").text();
		if (summary && summary.trim().length > 0) {
			entryElement.addClass("summary").addClass("collapsed");
			entryElement.find(".summary iframe").attr('tmpdoc', inlineStyle + summary);
		}

		// updated
		var dateString = entryData.find("updated").text();
		entryElement.find(".updated .raw span").text(dateString);
		try {
			var date = new Date(dateString);
			entryElement.find(".updated .absolute .second span").text(date.getSeconds());
			entryElement.find(".updated .absolute .second").attr("value", date.getSeconds());
			entryElement.find(".updated .absolute .minute span").text(date.getMinutes());
			entryElement.find(".updated .absolute .minute").attr("value", date.getMinutes());
			entryElement.find(".updated .absolute .hour span").text(date.getHours());
			entryElement.find(".updated .absolute .hour").attr("value", date.getHours());
			entryElement.find(".updated .absolute .day span").text(date.getDate());
			entryElement.find(".updated .absolute .day").attr("value", date.getDate());
			entryElement.find(".updated .absolute .month span").text(date.getMonth() + 1); // 0-based
			entryElement.find(".updated .absolute .month").attr("value", date.getMonth() + 1); // 0-based
			entryElement.find(".updated .absolute .year span").text(date.getFullYear());
			entryElement.find(".updated .absolute .year").attr("value", date.getFullYear());
		} catch (e) {
			console.log("Invalid date format: " + dateString);
			entryElement.find(".updated .absolute").remove();
		}
		updateRelativeTimestamp(entryElement);

		// content
		entryElement.find(".content").each(function() {
			var viewElement = this;

			// some feeds put same link in both content and enclosure link
			var duplicateDetector = {};

			var content = entryData.find("content");
			if (content.attr("type") !== undefined) {
				entryElement.addClass("contented").addClass("collapsed");
			}
			addContentPreviewToElement(content, viewElement, duplicateDetector);

			// add any 'enclosure' links
			entryData.find("link[rel='enclosure']").each(function() {
				var content = entryData.find("content");
				if (content.attr("type") !== undefined) {
					entryElement.addClass("contented").addClass("collapsed");
				}
				addContentPreviewToElement($(this), viewElement, duplicateDetector);
			});

			// add any 'alternate' links last
			entryData.find("link[rel='alternate']").each(function() {
				var content = entryData.find("content");
				if (content.attr("type") !== undefined) {
					entryElement.addClass("contented").addClass("collapsed");
				}
				addContentPreviewToElement($(this), viewElement, duplicateDetector);
			});

		});

		// populate form private encryption option with encryption key
		entryElement.find("option.private").attr("value", feedData.find("encrypt").text());
		new Composer(entryElement.find("form"));

		// catch all clicks on the entryElement
		entryElement.click(onEntryClick);

		return entryElement;
	};

	var inlineStyle = '<base target="_blank"/><style>* { font-family: sans-serif; font-size: 13px !important; } img { display: block; width: 100%; float:left; height: auto; margin-bottom: 30px; }</style>';

	var addContentPreviewToElement = function(dataElement, viewElement, duplicateDetector) {
		// handle both content elements and link enclosures
		var src = dataElement.attr("src");
		if (!src) {
			src = dataElement.attr("href");
		}
		src = model.resolveUrl(src, dataElement);

		if (!duplicateDetector[src]) {
			duplicateDetector[src] = src;
			var type = dataElement.attr("type");
			var verb = dataElement.attr("verb");
			var e;
			if (type !== undefined) {
				if (type.indexOf("video/") === 0) {
					e = $("<video controls preload='none'><source></audio>");
					e.find("source").attr("src", src);
					e.find("source").attr("type", type);
					$(viewElement).append(e);
				} else if (type.indexOf("audio/") === 0) {
					e = $("<audio controls preload='none'><source></audio>");
					e.find("source").attr("src", src);
					e.find("source").attr("type", type);
					$(viewElement).append(e);
				} else if (type.indexOf("image/") === 0) {
					e = $("<img width='100%'>");
					e.attr("src", src);
					$(viewElement).append(e);
				} else if (type.indexOf("application/atom") === 0) {
					var index;
					if ((index = src.indexOf("urn:feed:")) !== -1) {
						src = src.substring(index);
						// following a feed
						model.pull({
							feedId : src,
							count : 0
						}, function(feedData) {
							// following entry appears above followed feed
							createElementForFeedData(feedData).appendTo($(viewElement).closest(".entry"));
						});
					} else if ((index = src.indexOf("urn:entry:")) !== -1) {
						src = src.substring(index);
						// reposting an entry
						model.pull({
							feedId : src,
							count : 1
						}, function(feedData) {
							// reposting entry appears above reposted entry
							var entryData = $(feedData).children("entry").first();
							createElementForEntryData(feedData, entryData).appendTo($(viewElement).closest(".entry"));
						});
					} else {
						console.log("Unsupported atom link: " + src);
					}
				} else if (verb === "reply") {
					// get last mention:
					// this is the nearest parent in a tree of comments
					var ref = dataElement.find("mention").last().text();
					var prefix = src.indexOf("urn:entry:");
					if (prefix !== -1) {
						ref = ref.substring(prefix);
						model.pull({
							feedId : src,
							count : 1
						}, function(feedData) {
							// replying entry appears under mention entry
							var entryData = $(feedData).children("entry").first();
							createElementForEntryData(feedData, entryData).prependTo($(viewElement).closest(".entry"));
						});
					} else {
						console.log("Unexpected mention type for reply: " + ref);
					}
				} else if (src !== undefined) {
					e = $("<a target='_blank'><span></span></a>");
					e.attr("href", src);
					e.attr("title", src);
					e.children("span").text(src);
					$(viewElement).append(e);
				} else if (dataElement.text().trim().length > 0) {
					e = $("<div class='overlay'><iframe scrolling='no' seamless='seamless' sandbox=''></iframe></div>");
					e.find("iframe").attr("tmpdoc", inlineStyle + dataElement.text());
					// tmpdoc becomes srcdoc when expanded
					$(viewElement).append(e);
				} else {
					console.log("Unrecognized content type:" + type);
					// console.log(this);
				}
			} else {
				console.log("Missing content type:" + type);
				// console.log(this);
			}
		}
	};

	var onEntryClick = function(event) {
		var entryElement = $(event.target).closest('.entry');

		// if target was an action
		if ($(event.target).closest('.action').length !== 0) {
			var entryId;
			if ($(event.target).parents('.repost').length !== 0) {
				entryId = entryElement.attr("entry");
				if (entryElement.hasClass("reposted")) {
					entryElement.removeClass("reposted");
					model.unrepostEntry(entryId);
				} else {
					entryElement.addClass("reposted");
					model.repostEntry(entryElement.attr("entry"));
				}
				return;
			}
			if ($(event.target).parents(".like").length !== 0) {
				entryId = entryElement.attr("entry");
				if (entryElement.hasClass("liked")) {
					entryElement.removeClass("liked");
					model.unlikeEntry(entryId);
				} else {
					entryElement.addClass("liked");
					model.likeEntry(entryElement.attr("entry"));
				}
				return;
			}
			if ($(event.target).parents(".comment").length !== 0) {
				if (entryElement.hasClass("commented")) {
					entryElement.removeClass("commented");
					// (don't set focus)
				} else {
					entryElement.addClass("commented");
					entryElement.find("textarea").focus();
				}
				return;
			}
			// otherwise, fall through: toggle expand
			event.target = $(this);
		}

		// if target was an iframe's overlay
		if ($(event.target).hasClass('overlay')) {
			// $(event.target).parents('.content').find('a[href]').first().each(function()
			// {
			// // launch link if any
			// var href = this.getAttribute('href');
			// if (href) {
			// window.open(href.toString(), "_blank");
			// } else {
			// console.log("Overlay could not find href:");
			// console.log(a);
			// }
			// });
			// return;
			// note: now just falling through to expand/collapse
		}

		// if target was in the content section
		if ($(event.target).parents('.content .feed').length !== 0) {
			var url = $(event.target).parents('.content .feed').attr("feed");
			if (url.indexOf("urn:feed:") === 0) {
				url = url.substring("urn:feed:".length);
				window.history.pushState(null, null, "/" + url);
				onPopulate();
			}
			return;
		}

		// if target was in the content section
		if ($(event.target).parents('.content').length !== 0) {
			// handle normally
			return;
		}

		// if target was in the input section
		if ($(event.target).parents('.input').length !== 0) {
			// handle normally
			return;
		}

		// if target was an internal anchor
		var anchor = $(event.target).closest('a');
		if (anchor.length !== 0) {
			// trigger it
			var href = anchor.attr("href");
			if (href) {
				window.open(href, "_blank");
			} else {
				href = anchor.closest(".entry").attr("entry");
				if (href) {
					href = controller.feedIdFromEntryUrn(href);
					window.history.pushState(null, null, "/" + href);
					onPopulate();
				} else {
					console.log("Unrecognized anchor:");
					console.log(a);
				}
			}
			return;
		}

		// if collapsable/expandable then toggle
		if ($(this).hasClass("collapsed")) {
			$(this).removeClass("collapsed").addClass("expanded");
			// load iframed content when expanded
			$(this).find("iframe").each(function() {
				var tmpdoc = $(this).attr("tmpdoc");
				if (tmpdoc) {
					$(this).removeAttr("tmpdoc");
					$(this).attr("srcdoc", tmpdoc);
				}
			});
		} else if ($(this).hasClass("expanded")) {
			$(this).removeClass("expanded").addClass("collapsed");
		} else {
			// do nothing (for now)
		}
	};

	controller.entryIdFromEntryUrn = function(entryUrn) {
		return entryUrn.substring(entryUrn.lastIndexOf(":") + 1);
	};

	controller.feedIdFromEntryUrn = function(entryUrn) {
		return entryUrn.substring("urn:entry:".length, entryUrn.lastIndexOf(":"));
	};

	var getCurrentAccountId = function() {
		var id = localStorage.getItem("currentAccountId");
		if (!id) {
			id = model.getAuthenticatedAccountId();
		}
		return id;
	};

	var setCurrentAccountId = function(feedId) {
		// update the account menu
		$(".accounts .feed").removeClass("selected-account");

		if (feedId) {
			// our id is actually a urn
			if (feedId.indexOf(model.getAuthenticatedAccountId()) === -1) {
				// prompt to authenticate account
				controller.showPopup($(passwordVerifyTemplate).clone(), function() {
					// cancelled: clear current account
					setCurrentAccountId(null);
				}, function(form) {
					// entered password: now wait for validation or denial
					model.signIn(feedId, form.find('#password-verify').val(), function(feedData) {
						if (feedData) {
							// valid: manually dismiss popup
							controller.hidePopup();
							onSignIn(feedId);
							window.localStorage.setItem("currentAccountId", feedId);

						} else {
							// invalid: set error flags and keep open for retry
							form.addClass("invalid").addClass("invalid-password");
						}
					});
					return true; // stay open until authenticated
				});
			} else {
				onSignIn(feedId);
			}
		} else {
			model.signOut();
			window.localStorage.removeItem("currentAccountId");
			$(document.body).addClass("signed-out");
			$(document.body).removeClass("signed-in");
			onPopulate();
		}
		// we can show the account menu now
		$(document.body).removeClass("accounts-loading");
	};

	/** Update the UI to show we're logged in as the specified user id. */
	var onSignIn = function(feedId) {
		$(".accounts .feed[feed='" + feedId + "']").addClass("selected-account");
		$(document.body).removeClass("signed-out");
		$(document.body).addClass("signed-in");
		onPopulate();
	};

	var onAccountMenuClick = function(event) {
		if ($(document.body).hasClass("menu-showing")) {
			$(document.body).removeClass("menu-showing");
			// if target was a feed
			if ($(event.target).closest(".accounts").length !== 0) {
				setCurrentAccountId($(event.target).closest(".feed").attr("feed"));
				return;
			}
			// if target was logout
			if ($(event.target).closest(".logout").length !== 0) {
				setCurrentAccountId(null);
				return;
			}
			// if target was new
			if ($(event.target).closest(".create").length !== 0) {
				onCreateAccount();
				return;
			}
			// if target was edit
			if ($(event.target).closest(".edit").length !== 0) {
				onEditAccount();
				return;
			}
		} else {
			// otherwise just show the menu
			$(document.body).addClass("menu-showing");
		}
	};

	var onCreateAccount = function() {
		controller.showPopup($(passwordCreateTemplate).clone(), function() {
			// do nothing
		}, function(popup) {
			$(popup).removeClass("invalid-password-match");
			$(popup).removeClass("invalid-password-length");
			var create = $(popup).find('#password-create').val();
			var repeat = $(popup).find('#password-repeat').val();
			if (create.valueOf() !== repeat.valueOf()) {
				$(popup).addClass("error").addClass("invalid-password-match");
				return true;
			}
			if (create.length < 12) {
				$(popup).addClass("error").addClass("invalid-password-length");
				return true;
			}
			$(popup).addClass("authenticating");
			model.authenticateNewAccount(create, function(feedData) {
				if (feedData) {
					controller.hidePopup();
					console.log(feedData);
					$(createElementForFeedData(feedData)).addClass("menu-item").appendTo($("nav .accounts"));
					setCurrentAccountId($(feedData).find("id").text());
					onEditAccount(); // confusing?
				} else {
					$(popup).addClass("error");
				}
			});
		});
	};

	var onEditAccount = function() {
		// pull latest feed data
		var id = model.getAuthenticatedAccountId();
		if (id.indexOf("urn:feed:") === 0) {
			id = id.substring("urn:feed:".length);
		}
		model.pull({
			feedId : id
		}, function(feedData) {
			var form = $(feedEditTemplate).clone();
			var iconSrc = feedData.children("icon").text();
			iconSrc = model.resolveUrl(iconSrc, feedData.children("icon"));
			if (iconSrc) {
				form.find(".icon").css("background-image", "url('" + iconSrc + "')");
				// some styles may choose to hide the foreground img
				// form.find(".icon img").attr("src", iconSrc);
			}
			// strip id from base
			var base = feedData.attr("xml:base");
			if (base) {
				var index = base.indexOf(id);
				if (index > 1) {
					base = base.substring(0, index - 1);
				}
			} else {
				// default to trsst hub
				base = "http://home.trsst.com/feed";
			}
			form.find(".title input").val(feedData.children("title").text());
			form.find(".subtitle textarea").val(feedData.children("subtitle").text());
			form.find(".base input").val(base);
			form.find(".icon img").click(function(e) {
				// trigger the hidden file field
				form.find(".icon input").focus().trigger('click');
			});
			controller.showPopup(form, function() {
				// do nothing
				console.log("CANCELLED");
			}, function(popup) {
				model.updateFeed(new FormData(form[0]), function(feedData) {
					if (feedData) {
						controller.hidePopup();
						console.log(feedData);
						// replace with updated data
						$("nav .accounts .selected-account").remove();
						$(createElementForFeedData(feedData)).addClass("menu-item").appendTo($("nav .accounts"));
						setCurrentAccountId($(feedData).find("id").text());
					} else {
						$(popup).addClass("error");
					}
				});
			});
		});
	};

	var updateRelativeTimestamp = function(entryElement) {
		var dateString = entryElement.find(".updated .raw span").text();
		try {
			var granularity = "seconds";
			var diff = Math.floor((new Date().getTime() - Date.parse(dateString)) / 1000);
			var value = diff % 60;
			diff = Math.floor(diff / 60);
			if (diff > 0) {
				granularity = "minutes";
			}
			entryElement.find(".updated .relative .seconds span").text(value);
			entryElement.find(".updated .relative .seconds").attr("value", value);

			value = diff % 60;
			diff = Math.floor(diff / 60);
			if (diff > 0) {
				granularity = "hours";
			}
			entryElement.find(".updated .relative .minutes span").text(value);
			entryElement.find(".updated .relative .minutes").attr("value", value);

			value = diff % 24;
			diff = Math.floor(diff / 60);
			if (diff > 0) {
				granularity = "days";
			}
			entryElement.find(".updated .relative .hours span").text(value);
			entryElement.find(".updated .relative .hours").attr("value", value);

			value = diff % 30;
			diff = Math.floor(diff / 24);
			if (diff > 0) {
				granularity = "months";
			}
			entryElement.find(".updated .relative .days span").text(value);
			entryElement.find(".updated .relative .days").attr("value", value);

			value = diff % 12;
			diff = Math.floor(diff / 30);
			if (diff > 0) {
				granularity = "years";
			}
			entryElement.find(".updated .relative .months span").text(value);
			entryElement.find(".updated .relative .months").attr("value", value);

			value = diff % 12;
			diff = Math.floor(diff / 12);
			entryElement.find(".updated .relative .years span").text(value);
			entryElement.find(".updated .relative .years").attr("value", value);

			// use this to determine what time unit to show
			entryElement.find(".updated").attr('class', 'updated ' + granularity);
		} catch (e) {
			console.log("updateRelativeTimestamp: Invalid date format: " + dateString);
			console.log(e);
			entryElement.find(".updated .relative").remove();
		}
	};

	var popupContainer = $(document.body).find("#popupContainer");
	var popupBackdrop = $(document.body).find("#popupBackdrop");
	popupBackdrop.click(function(e) {
		if (e.target === popupBackdrop.get(0)) {
			controller.hidePopup();
		}
	});

	/**
	 * Places the specified element in a modal popup, calling onCancel when the
	 * popup is dismissed. If onConfirm is specified, the popup shows "OK" and
	 * "Cancel" and calls either onConfirm or onCancel respectively. If onCancel
	 * or onConfirm return true, the popup is not dismissed.
	 */
	controller.showPopup = function(element, onCancel, onConfirm) {
		controller.hidePopup();
		popupContainer.append(element);
		if (onConfirm) {
			popupContainer.addClass("confirmable");
			var confirmHandler = function() {
				if (!onConfirm(popupContainer)) {
					controller.hidePopup();
				}
			};
			$("<button class='confirm'><span></span></button>").appendTo(popupContainer).click(confirmHandler);
			$(element).find("input").keyup(function(e) {
				// trigger on enter key
				var code = (e.keyCode ? e.keyCode : e.which);
				if (code == 13) {
					confirmHandler();
				}
			});
		}
		if (onCancel) {
			var cancelHandler = function() {
				if (!onCancel(popupContainer)) {
					controller.hidePopup();
				}
			};
			$("<button class='cancel'><span></span></button>").appendTo(popupContainer).click(cancelHandler);
			$(element).keyup(function(e) {
				// trigger on escape key
				var code = (e.keyCode ? e.keyCode : e.which);
				if (code == 27) {
					cancelHandler();
				}
			});
		}
		$(document.body).addClass("popup-showing");
		$(element).find("input").get(0).focus();

		return popupContainer;
	};

	controller.hidePopup = function() {
		popupContainer.removeClass("confirmable");
		$(document.body).removeClass("popup-showing");
		popupContainer.empty();
	};

	var populateAccountMenu = function() {
		/* Get all local accounts and display them. */
		model.getAccounts(function(result) {
			var accounts = $("nav .accounts");
			accounts.empty();
			var accountId = getCurrentAccountId();
			if (result.length === 0 || accountId === null || result.indexOf(accountId) === -1) {
				// no matching accounts: update the UI
				setCurrentAccountId(null);
			}

			// need to pull each account to populate the UI
			for ( var id in result) {
				// fetch feed
				var currentId = result[id];
				model.pull({
					feedId : currentId
				}, createFeedMenuItem);
			}
		});

	};

	var createFeedMenuItem = function(feedData) {
		if (feedData) {
			$(createElementForFeedData(feedData)).addClass("menu-item").appendTo($("nav .accounts"));
			if (getCurrentAccountId() === feedData.children("id").text()) {
				// update the UI
				setCurrentAccountId(getCurrentAccountId());
			}
		} else {
			console.log("Could not read account data for feed");
		}
	};

	// h/t Carlo-Zottmann http://stackoverflow.com/questions/6539761
	var searchToObject = function() {
		var pairs = window.location.search.substring(1).split("&"), obj = {}, pair, i;
		for (i in pairs) {
			if (pairs[i] === "")
				continue;
			pair = pairs[i].split("=");
			obj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
		}
		return obj;
	};

	var onInit = function() {

		/* Ensure relative timestamps are "live" and updated */
		window.setInterval(function() {
			$(".entry").each(function() {
				updateRelativeTimestamp($(this));
			});
		}, 60000); // each minute

		/* Initial state is "signed-out" */
		$(document.body).addClass("signed-out");

		/* Don't display accounts until loaded */
		$(document.body).addClass("accounts-loading");
		populateAccountMenu();

		/* Enable account menu clicks */
		$("nav").click(onAccountMenuClick);

		/* Enable back button clicks */
		$(".menu-item.back").click(function() {
			window.history.back();
		});

		/* Reroute all preexisting anchors */
		$("a").click(function(e) {
			var a = $(e.target).closest("a");
			if (a.attr("target") !== "_blank") {
				e.preventDefault();
				var url = a.attr("href");
				if (url) {
					window.history.pushState(null, null, url);
					onPopulate();
				}
			}
		});

		/* Enable feed id/url paste */
		$(".util-feed-navigator form").submit(function(e) {
			e.preventDefault();
			var url = $(".util-feed-navigator form input").val();
			if (url) {
				window.history.pushState(null, null, "/" + url.trim());
				onPopulate();
			}
		});

		/* Enable feed id/url paste */
		$(".util-feed-navigator form").submit(function(e) {
			e.preventDefault();
			var url = $(".util-feed-navigator form input").val();
			if (url) {
				window.history.pushState(null, null, "/" + url.trim());
				onPopulate();
			}
		});

		/* Enable global search bar */
		$(".util-search form").submit(function(e) {
			e.preventDefault();
			var query = $(".util-search form input").val();
			if (query) {
				query = query.trim();
				var params = searchToObject();
				params.q = encodeURIComponent(query);
				query = "?";
				// reassemble query params
				for ( var i in params) {
					query = query + i + "=" + params[i] + "&";
				}
				// strip last & or ?
				query = query.substring(0, query.length - 1);

				// navigate with new query
				window.history.pushState(null, null, "/" + query);
				onPopulate();
			}
		});

		new Composer($(document).find(".private.messaging form"));
		new Composer($("article>.composer").get());
	};

	var pollsters = [];
	var onPopulate = function() {
		var host = window.location.host;
		var path = window.location.toString();

		/* Enable "Open in Browser" */
		$(".util-browser-launcher a").attr("target", "_blank").attr("href", path);

		console.log("onPopulate: " + host + " : " + path);
		for ( var i in pollsters) {
			pollsters[i].stop();
		}
		pollsters = [];

		var j = path.indexOf(host);
		if (j !== -1) {
			path = path.substring(j + host.length + 1);
		}

		if (window.history.length > 1) {
			$("body").addClass("has-back");
		} else {
			$("body").removeClass("has-back");
		}

		var pollster;
		if (path.trim().length > 1) {

			$("body").removeClass("page-home");
			$("body").removeClass("page-entry");
			$("body").addClass("page-feed");

			pollster = new EntryPollster(createElementForEntryData, $("#entryContainer"));
			pollster.addFeed(path);
			pollsters.push(pollster);

			// some trickery to keep private msg in sync with feed
			var customCreateElementForFeedData = function(feedData) {
				// update form private encryption option with encryption key
				var privateMessaging = $(document).find(".private.messaging");
				privateMessaging.find("option.private").attr("value", feedData.find("encrypt").text());
				return createElementForFeedData(feedData);
			};

			pollster = new FeedPollster(customCreateElementForFeedData, $("#feedContainer"));
			pollster.addFeed(path);
			pollsters.push(pollster);

		} else {
			$("body").addClass("page-home");
			$("body").removeClass("page-entry");
			$("body").removeClass("page-feed");

			var id = getCurrentAccountId();
			if (!id) {
				id = "8crfxaHcBWTHuhA8cXfwPc3vfJ3SbsRpJ";
			}

			pollster = new FeedPollster(createElementForFeedData, $("#feedContainer"));
			pollsters.push(pollster);
			pollster.addFeed(id);

			pollster = new EntryPollster(createElementForEntryData, $("#entryContainer"));
			pollsters.push(pollster);
			pollster.addFeed(id);

			pollster.addFeedFollows(id);
			// TESTING: high volume test
			// "http://api.flickr.com/services/feeds/photos_public.gne" );
			// //
		}
	};

	controller.start = function() {
		// onPopulate();
		window.onpopstate = function(event) {
			onPopulate();
		};
	};

	onInit();

})(window);

$(document).ready(function() {
	controller.start();

	// firebug
	// if (!document.getElementById('FirebugLite')) {
	// E = document['createElement' + 'NS'] &&
	// document.documentElement.namespaceURI;
	// E = E ? document['createElement' + 'NS'](E, 'script') :
	// document['createElement']('script');
	// E['setAttribute']('id', 'FirebugLite');
	// E['setAttribute']('src', 'https://getfirebug.com/' + 'firebug-lite.js' +
	// '#startOpened');
	// E['setAttribute']('FirebugLite', '4');
	// (document['getElementsByTagName']('head')[0] ||
	// document['getElementsByTagName']('body')[0]).appendChild(E);
	// E = new Image;
	// E['setAttribute']('src', 'https://getfirebug.com/' + '#startOpened');
	// }
});
