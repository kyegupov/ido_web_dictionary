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
        if (query != this.queryAsAlreadyProcessed && query != "") {
            this.queryAsAlreadyProcessed = query;
            $("b").removeClass("red");
            IdoDictionaryUi.fade_articles();
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
            }, immediately ? 0 : DELAY_REQUEST_MS);
            this.queryAsAlreadyProcessed = query;
        }
    };
    IdoDictionaryUi.make_link = function (keyword) {
        return '<a href="#" class="suggested_word">' + keyword + "</a>";
    };
    IdoDictionaryUi.fade_articles = function () {
        $("#content").addClass("fade");
    };
    IdoDictionaryUi.unfade_articles = function () {
        $("#content").removeClass("fade");
    };
    IdoDictionaryUi.prototype.displayResults = function (searchResponse) {
        var _this = this;
        var r1 = this.displayLanguageResults(searchResponse.e, "e");
        var r2 = this.displayLanguageResults(searchResponse.i, "i");
        if (!r1 && !r2) {
            $("#content-e")[0].innerHTML = "No matching words found";
        }
        if (r1 && r2) {
            $("#separator").show();
        }
        else {
            $("#separator").hide();
        }
        $("a.suggested_word").click(function (event) {
            $("#searchbox").val(event.target.textContent);
            _this.refresh_wordlist(true);
        });
        IdoDictionaryUi.unfade_articles();
        $("b[fullkey~='" + this.queryAsAlreadyProcessed + "']").addClass("red");
    };
    IdoDictionaryUi.prototype.displayLanguageResults = function (langSearchResponse, langCode) {
        var linksHtml = [];
        if (langSearchResponse.suggestions) {
            for (var _i = 0, _a = langSearchResponse.suggestions; _i < _a.length; _i++) {
                var word = _a[_i];
                linksHtml.push("<b>" + IdoDictionaryUi.make_link(word) + "</b>");
            }
        }
        else {
            IdoDictionaryUi.fade_articles();
        }
        var wordsHtml = linksHtml.join(" · ");
        if (langSearchResponse.totalSuggestions > langSearchResponse.suggestions.length) {
            wordsHtml += "... " + langSearchResponse.totalSuggestions + " matching words found";
        }
        $("#words-" + langCode)[0].innerHTML = wordsHtml;
        $("#content-" + langCode)[0].innerHTML = langSearchResponse.articlesHtml.join("<hr>");
        if (langSearchResponse.totalSuggestions > 0) {
            $("#heading-" + langCode).show();
            return true;
        }
        else {
            $("#heading-" + langCode).hide();
        }
    };
    return IdoDictionaryUi;
}());
var app = new IdoDictionaryUi();
$(document).ready(function () { return app.main(); });
//# sourceMappingURL=ido_web_dict.js.map