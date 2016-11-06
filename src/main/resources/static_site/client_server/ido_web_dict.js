/// <reference path="jquery.d.ts" />
var SearchResponse = (function () {
    function SearchResponse() {
    }
    return SearchResponse;
}());
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
                $.get("api/search?lang=" + _this.dir + "&query=" + query, function (jsonResponse) {
                    if (_this.timestampOfLastCompletedRequest == null
                        || _this.timestampOfLastCompletedRequest < timestampRequestStarted) {
                        _this.display_results(jsonResponse);
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
    IdoDictionaryUi.prototype.display_results = function (searchResponse) {
        var _this = this;
        var linksHtml = [];
        if (searchResponse.suggestions) {
            for (var _i = 0, _a = searchResponse.suggestions; _i < _a.length; _i++) {
                var word = _a[_i];
                linksHtml.push("<b>" + IdoDictionaryUi.make_link(word) + "</b>");
            }
        }
        else {
            IdoDictionaryUi.fade_articles();
        }
        var wordsHtml = linksHtml.join(" · ");
        if (searchResponse.totalSuggestions > searchResponse.suggestions.length) {
            wordsHtml += "... " + searchResponse.totalSuggestions + " matching words found";
        }
        if (!wordsHtml) {
            wordsHtml = "No matching words found";
        }
        $("#words")[0].innerHTML = wordsHtml;
        $("#content")[0].innerHTML = searchResponse.articlesHtml.join("<hr>");
        $("a.suggested_word").click(function (event) {
            $("#searchbox").val(event.target.textContent);
            _this.refresh_wordlist(true);
        });
        IdoDictionaryUi.unfade_articles();
        $("b[fullkey~='" + this.queryAsAlreadyProcessed + "']").addClass("red");
    };
    return IdoDictionaryUi;
}());
var app = new IdoDictionaryUi();
$(document).ready(function () { return app.main(); });
//# sourceMappingURL=ido_web_dict.js.map