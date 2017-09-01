/// <reference path="jquery.d.ts" />
var DELAY_REQUEST_MS = 300;
var BASE_TITLE = "Ido ↔ English dictionary by Dyer";
var LANG_HUMAN_NAMES = {
    "en-io": "English – Ido",
    "io-en": "Ido – English",
    "io-ru-io": "Ido – Russian"
};
var IdoDictionaryUi = (function () {
    function IdoDictionaryUi() {
        this.queryAsAlreadyProcessed = ""; // previous query
        this.wordToHighlight = "";
    }
    IdoDictionaryUi.prototype.main = function () {
        var _this = this;
        this.queryAsAlreadyProcessed = "";
        $("select[name=mode]").change(function (event) {
            _this.mode = $(event.target).val();
            if (_this.mode == "single_word") {
                $(".phrase").hide();
            }
            else {
                $(".phrase").show();
            }
            _this.handleSearchBoxChange(true, true);
        });
        $("select[name=lang]").change(function () {
            _this.handleSearchBoxChange(true, true);
        });
        $("#searchbox").on("input", function () {
            _this.handleSearchBoxChange(true, false);
        });
        this.mode = "single_word";
        window.onpopstate = function (e) { return _this.handleUrl(); };
        this.handleUrl();
    };
    IdoDictionaryUi.prototype.handleSearchBoxChange = function (updateUrl, force) {
        var query = $("#searchbox").val().trim();
        if (query.trim() == "") {
            $("#banner").show();
            $(".results").hide();
        }
        if (force || (query != this.queryAsAlreadyProcessed && query != "")) {
            var lang = $("select[name=lang]").val();
            if (this.mode == "single_word") {
                this.phrase = null;
                this.searchWord(query.toLowerCase(), lang, false, null, updateUrl);
            }
            else {
                this.phrase = query;
                this.searchPhrase(query, lang, false, updateUrl);
            }
            this.queryAsAlreadyProcessed = query;
        }
    };
    IdoDictionaryUi.prototype.setupServerRequest = function (url, callback, immediately) {
        var _this = this;
        IdoDictionaryUi.fadeResults();
        if (this.delayedRequestHandle) {
            clearTimeout(this.delayedRequestHandle);
        }
        this.delayedRequestHandle = setTimeout(function () {
            var timestampRequestStarted = Date.now();
            $.get(url, function (jsonResponse) {
                if (_this.timestampOfLastCompletedRequest == null
                    || _this.timestampOfLastCompletedRequest < timestampRequestStarted) {
                    callback(jsonResponse);
                    _this.timestampOfLastCompletedRequest = timestampRequestStarted;
                }
            });
            IdoDictionaryUi.fadeResults();
        }, immediately ? 0 : DELAY_REQUEST_MS);
    };
    IdoDictionaryUi.prototype.searchWord = function (query, lang, immediately, language, updateUrl) {
        var _this = this;
        var url = "api/search?lang=" + lang + "&query=" + query;
        if (language != null) {
            url += "&lang=" + language;
        }
        var wordQuery = query;
        this.setupServerRequest(url, function (jsonResponse) {
            _this.displayResults(wordQuery, jsonResponse);
            var title = BASE_TITLE + ": " + query;
            if (updateUrl) {
                window.history.pushState({ word: query }, title, "#?lang=" + lang + "&word=" + encodeURIComponent(query));
            }
            else {
                window.document.title = title;
            }
        }, immediately);
    };
    IdoDictionaryUi.prototype.searchPhrase = function (query, lang, immediately, updateUrl) {
        var _this = this;
        this.setupServerRequest("api/phrase?lang=" + lang + "&query=" + query, function (jsonResponse) {
            _this.displayPhraseResults(jsonResponse);
            var title = BASE_TITLE + ": " + query;
            if (updateUrl) {
                window.history.pushState({ phrase: query }, title, "#?lang=" + lang + "&phrase=" + encodeURIComponent(query));
            }
            else {
                window.document.title = title;
            }
        }, immediately);
    };
    // TODO: HTML sanitizing
    IdoDictionaryUi.makeSearchLink = function (lang, keyword) {
        return "<a href=\"#?lang=" + lang + "&word=" + encodeURIComponent(keyword) + "\" class=\"suggested_word\">" + keyword + "</a>";
    };
    IdoDictionaryUi.prototype.makeQuickSearchLink = function (lang, word) {
        return "<a href=\"#?lang=" + lang + "&phrase=" + encodeURIComponent(this.phrase) + "\" class=\"suggested_phrase_word\" "
            + ("keyword=\"" + word.normalizedWord + "\">") + word.originalWord + "</a>";
    };
    IdoDictionaryUi.fadeResults = function () {
        $("b").removeClass("red");
        $(".results").addClass("fade");
    };
    IdoDictionaryUi.unfadeResults = function () {
        $("#banner").hide();
        $(".results").show();
        $(".results").removeClass("fade");
    };
    IdoDictionaryUi.prototype.displayResults = function (wordQuery, searchResponse) {
        $(".per_direction_result:not(.template)").remove();
        var anyResults = false;
        for (var _i = 0, _a = Object.keys(searchResponse); _i < _a.length; _i++) {
            var direction = _a[_i];
            anyResults = anyResults || IdoDictionaryUi.displayLanguageResults(searchResponse[direction], direction);
        }
        if (!anyResults) {
            $(".nope")[0].innerHTML = "No matching words found";
            $(".nope").show();
        }
        else {
            $(".nope").hide();
        }
        IdoDictionaryUi.unfadeResults();
        $("*[dict-key*='" + wordQuery + "']").addClass("red");
    };
    IdoDictionaryUi.displayLanguageResults = function (langSearchResponse, langCode) {
        var linksHtml = [];
        if (!langSearchResponse || langSearchResponse.totalSuggestions == 0) {
            $("." + langCode).hide();
            return false;
        }
        var lang = $("select[name=lang]").val();
        if (langSearchResponse.suggestions) {
            for (var _i = 0, _a = langSearchResponse.suggestions; _i < _a.length; _i++) {
                var word = _a[_i];
                linksHtml.push("<b>" + IdoDictionaryUi.makeSearchLink(lang, word) + "</b>");
            }
        }
        else {
        }
        var wordsHtml = linksHtml.join(" · ");
        if (langSearchResponse.totalSuggestions > langSearchResponse.suggestions.length) {
            if (wordsHtml) {
                wordsHtml += "... ";
            }
            wordsHtml += langSearchResponse.totalSuggestions + " matching words found";
        }
        var target = $(".per_direction_results .template").clone();
        target.appendTo($(".per_direction_results"));
        target.removeClass("template");
        target.find(".heading")[0].innerHTML = LANG_HUMAN_NAMES[langCode];
        target.find(".words")[0].innerHTML = wordsHtml;
        target.find(".articles")[0].innerHTML = langSearchResponse.articlesHtml.join("<hr>");
        return true;
    };
    IdoDictionaryUi.prototype.displayPhraseResults = function (words) {
        var _this = this;
        $(".per_direction_result:not(.template)").remove();
        if (!words) {
            $(".nope")[0].innerHTML = "No matching words found";
            $(".nope").show();
        }
        else {
            $(".nope").hide();
            IdoDictionaryUi.unfadeResults();
        }
        var linksHtml = [];
        var lang = $("select[name=lang]").val();
        for (var _i = 0, words_1 = words; _i < words_1.length; _i++) {
            var word = words_1[_i];
            if (word.normalizedWord) {
                linksHtml.push("<b>" + this.makeQuickSearchLink(lang, word) + "</b>");
            }
            else {
                linksHtml.push(word.originalWord);
            }
        }
        $(".phrase").html(linksHtml.join(""));
        $("a.suggested_phrase_word").click(function (event) {
            var lang = $("select[name=lang]").val();
            _this.searchWord(event.target.getAttribute("keyword"), lang, true, "i", false);
        });
    };
    IdoDictionaryUi.prototype.handleUrl = function () {
        var phrase = getUrlFragmentParameterByName("phrase");
        var word = getUrlFragmentParameterByName("word");
        if (phrase) {
            this.mode = "ido_phrase";
            $("#searchbox").val(phrase);
            this.handleSearchBoxChange(false, false);
        }
        else {
            if (word) {
                this.mode = "single_word";
                $("#searchbox").val(word);
                this.handleSearchBoxChange(false, false);
            }
        }
    };
    return IdoDictionaryUi;
}());
// Adapted from http://stackoverflow.com/a/901144
function getUrlFragmentParameterByName(name) {
    var url = window.location.hash;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"), results = regex.exec(url);
    if (!results)
        return null;
    if (!results[2])
        return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}
var app = new IdoDictionaryUi();
$(document).ready(function () { return app.main(); });
