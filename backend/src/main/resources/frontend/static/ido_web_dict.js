/// <reference path="jquery.d.ts" />
var DELAY_REQUEST_MS = 300;
var BASE_TITLE = "Ido ↔ English dictionary by Dyer";
var IdoDictionaryUi = (function () {
    function IdoDictionaryUi() {
        this.queryAsAlreadyProcessed = ""; // previous query
        this.wordToHighlight = "";
    }
    IdoDictionaryUi.prototype.main = function () {
        var _this = this;
        this.queryAsAlreadyProcessed = "";
        $("input:radio[name=search-type]").change(function (event) {
            _this.mode = $(event.target).val();
            if (_this.mode == "single_word") {
                $(".phrase").hide();
            }
            else {
                $(".phrase").show();
            }
            _this.handleSearchBoxChange(true);
        });
        $("#searchbox").on("input", function () {
            _this.handleSearchBoxChange(true);
        });
        $("input:radio[name=search-type][value=single_word]").click();
        this.mode = "single_word";
        window.onpopstate = function (e) { return _this.handleUrl(); };
        this.handleUrl();
    };
    IdoDictionaryUi.prototype.handleSearchBoxChange = function (updateUrl) {
        var query = $("#searchbox").val().trim();
        if (query.trim() == "") {
            $("#banner").show();
            $(".results").hide();
        }
        if (query != this.queryAsAlreadyProcessed && query != "") {
            var title = BASE_TITLE + ": " + query;
            if (this.mode == "single_word") {
                if (updateUrl) {
                    window.history.pushState({ word: query }, title, "#?word=" + encodeURIComponent(query));
                }
                else {
                    window.document.title = title;
                }
                this.phrase = null;
                this.searchWord(query.toLowerCase(), false, null);
            }
            else {
                if (updateUrl) {
                    window.history.pushState({ phrase: query }, title, "#?phrase=" + encodeURIComponent(query));
                }
                else {
                    window.document.title = title;
                }
                this.phrase = query;
                this.searchPhrase(query, false);
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
    IdoDictionaryUi.prototype.searchWord = function (query, immediately, language) {
        var _this = this;
        var url = "api/search?query=" + query;
        if (language != null) {
            url += "&lang=" + language;
        }
        var wordQuery = query;
        this.setupServerRequest(url, function (jsonResponse) { return _this.displayResults(wordQuery, jsonResponse); }, immediately);
    };
    IdoDictionaryUi.prototype.searchPhrase = function (query, immediately) {
        var _this = this;
        this.setupServerRequest("api/phrase?query=" + query, function (jsonResponse) { return _this.displayPhraseResults(jsonResponse); }, immediately);
    };
    // TODO: HTML sanitizing
    IdoDictionaryUi.makeSearchLink = function (keyword) {
        return "<a href=\"#?word=" + encodeURIComponent(keyword) + "\" class=\"suggested_word\">" + keyword + "</a>";
    };
    IdoDictionaryUi.prototype.makeQuickSearchLink = function (word) {
        return "<a href=\"#?phrase=" + encodeURIComponent(this.phrase) + "\" class=\"suggested_phrase_word\" "
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
        var r1 = IdoDictionaryUi.displayLanguageResults(searchResponse.e, "en-io");
        var r2 = IdoDictionaryUi.displayLanguageResults(searchResponse.i, "io-en");
        if (!r1 && !r2) {
            $(".nope")[0].innerHTML = "No matching words found";
            $(".nope").show();
        }
        else {
            $(".nope").hide();
        }
        if (r1 && r2) {
            $("#separator").show();
        }
        else {
            $("#separator").hide();
        }
        IdoDictionaryUi.unfadeResults();
        $("b[dict-key*='" + wordQuery + "']").addClass("red");
    };
    IdoDictionaryUi.displayLanguageResults = function (langSearchResponse, langCode) {
        var linksHtml = [];
        if (!langSearchResponse || langSearchResponse.totalSuggestions == 0) {
            $("." + langCode).hide();
            return false;
        }
        if (langSearchResponse.suggestions) {
            for (var _i = 0, _a = langSearchResponse.suggestions; _i < _a.length; _i++) {
                var word = _a[_i];
                linksHtml.push("<b>" + IdoDictionaryUi.makeSearchLink(word) + "</b>");
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
        $("." + langCode + " .words")[0].innerHTML = wordsHtml;
        $("." + langCode + " .articles")[0].innerHTML = langSearchResponse.articlesHtml.join("<hr>");
        $("." + langCode).show();
        return true;
    };
    IdoDictionaryUi.prototype.displayPhraseResults = function (words) {
        var _this = this;
        if (!words) {
            $(".nope")[0].innerHTML = "No matching words found";
            $(".nope").show();
        }
        else {
            $(".nope").hide();
            $(".en-io").hide();
            $(".io-en").hide();
            IdoDictionaryUi.unfadeResults();
        }
        var linksHtml = [];
        for (var _i = 0, words_1 = words; _i < words_1.length; _i++) {
            var word = words_1[_i];
            if (word.normalizedWord) {
                linksHtml.push("<b>" + this.makeQuickSearchLink(word) + "</b>");
            }
            else {
                linksHtml.push(word.originalWord);
            }
        }
        $(".phrase").html(linksHtml.join(""));
        $("a.suggested_phrase_word").click(function (event) {
            _this.searchWord(event.target.getAttribute("keyword"), true, "i");
        });
    };
    IdoDictionaryUi.prototype.handleUrl = function () {
        var phrase = getUrlFragmentParameterByName("phrase");
        var word = getUrlFragmentParameterByName("word");
        if (phrase) {
            $("input:radio[name=search-type][value=ido_phrase]").click();
            $("#searchbox").val(phrase);
            this.handleSearchBoxChange(false);
        }
        else {
            if (word) {
                $("input:radio[name=search-type][value=single_word]").click();
                $("#searchbox").val(word);
                this.handleSearchBoxChange(false);
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
