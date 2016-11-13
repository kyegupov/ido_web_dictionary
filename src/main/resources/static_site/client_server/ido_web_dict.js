/// <reference path="jquery.d.ts" />
var DELAY_REQUEST_MS = 300;
var IdoDictionaryUi = (function () {
    function IdoDictionaryUi() {
        this.queryAsAlreadyProcessed = ""; // previous query
    }
    IdoDictionaryUi.prototype.main = function () {
        var _this = this;
        this.queryAsAlreadyProcessed = "";
        $("input:radio[name=direction]").change(function (event) {
            _this.dir = $(event.target).val()[0];
            _this.queryAsAlreadyProcessed = "";
            _this.refresh_wordlist();
        });
        $("#searchbox").on("input", function () { return _this.refresh_wordlist(); });
        $("input:radio[name=direction][value=ido-eng]").click();
    };
    IdoDictionaryUi.prototype.refresh_wordlist = function (immediately) {
        var _this = this;
        if (immediately === void 0) { immediately = false; }
        var query = $("#searchbox").val().toLowerCase().trim();
        if (query.trim() == "") {
            $("#banner").show();
            $(".results").hide();
        }
        if (query != this.queryAsAlreadyProcessed && query != "") {
            this.queryAsAlreadyProcessed = query;
            $("b").removeClass("red");
            IdoDictionaryUi.fadeResults();
            if (this.delayedRequestHandle) {
                clearTimeout(this.delayedRequestHandle);
            }
            this.delayedRequestHandle = setTimeout(function () {
                var timestampRequestStarted = Date.now();
                $.get("api/search?&query=" + query, function (jsonResponse) {
                    if (_this.timestampOfLastCompletedRequest == null
                        || _this.timestampOfLastCompletedRequest < timestampRequestStarted) {
                        _this.displayResults(jsonResponse);
                        _this.timestampOfLastCompletedRequest = timestampRequestStarted;
                    }
                });
                IdoDictionaryUi.fadeResults();
            }, immediately ? 0 : DELAY_REQUEST_MS);
            this.queryAsAlreadyProcessed = query;
        }
    };
    IdoDictionaryUi.makeLink = function (keyword) {
        return '<a href="#" class="suggested_word">' + keyword + "</a>";
    };
    IdoDictionaryUi.fadeResults = function () {
        $(".results").addClass("fade");
    };
    IdoDictionaryUi.unfadeResults = function () {
        $("#banner").hide();
        $(".results").show();
        $(".results").removeClass("fade");
    };
    IdoDictionaryUi.prototype.displayResults = function (searchResponse) {
        var _this = this;
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
            $(".separator").show();
        }
        else {
            $(".separator").hide();
        }
        $("a.suggested_word").click(function (event) {
            $("#searchbox").val(event.target.textContent);
            _this.refresh_wordlist(true);
        });
        IdoDictionaryUi.unfadeResults();
        $("b[fullkey~='" + this.queryAsAlreadyProcessed + "']").addClass("red");
    };
    IdoDictionaryUi.displayLanguageResults = function (langSearchResponse, langCode) {
        var linksHtml = [];
        if (langSearchResponse.suggestions) {
            for (var _i = 0, _a = langSearchResponse.suggestions; _i < _a.length; _i++) {
                var word = _a[_i];
                linksHtml.push("<b>" + IdoDictionaryUi.makeLink(word) + "</b>");
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
        if (langSearchResponse.totalSuggestions > 0) {
            $("." + langCode + " .heading").show();
            return true;
        }
        else {
            $("." + langCode + " .heading").hide();
            return false;
        }
    };
    return IdoDictionaryUi;
}());
var app = new IdoDictionaryUi();
$(document).ready(function () { return app.main(); });
//# sourceMappingURL=ido_web_dict.js.map