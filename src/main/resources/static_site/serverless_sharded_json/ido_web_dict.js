/// <reference path="jquery.d.ts" />
var ARTICLES_PER_CHUNK = 100;
var DictionaryData = (function () {
    function DictionaryData() {
    }
    return DictionaryData;
}());
var IdoDictionaryUi = (function () {
    function IdoDictionaryUi() {
        this.queryAsAlreadyProcessed = ""; // previous query
    }
    IdoDictionaryUi.prototype.main = function () {
        var _this = this;
        this.queryAsAlreadyProcessed = "";
        this.e = { index: {}, articles: {} };
        this.i = { index: {}, articles: {} };
        this.articlesToDisplay = [];
        $("input:radio[name=direction]").click(function (event) {
            _this.dir = $(event.target).val()[0];
            _this.queryAsAlreadyProcessed = "";
            _this.refresh_wordlist();
        });
        $("#searchbox").on("input", function () { return _this.refresh_wordlist(); });
        $("input:radio[name=direction][value=ido-eng]").click();
    };
    IdoDictionaryUi.prototype.refresh_wordlist = function () {
        var _this = this;
        var query = $("#searchbox").val().toLowerCase().trim();
        if (query != this.queryAsAlreadyProcessed && query != "") {
            this.queryAsAlreadyProcessed = query;
            $("b").removeClass("red");
            var exactMatches = [];
            var partialMatches = [];
            var firstLetter = query.charAt(0);
            if (!/[a-z]/.test(firstLetter)) {
                return;
            }
            var dictionary = this[this.dir];
            if (!dictionary[firstLetter]) {
                $.get(this.dir + "/index_" + firstLetter + ".json", function (data) {
                    _this[_this.dir][firstLetter] = data;
                    _this.refresh_wordlist();
                });
                this[this.dir][firstLetter] = {}; // Block subsequent requests
                return;
            }
            var subIndex = dictionary[firstLetter];
            var qlen = query.length;
            for (var key in subIndex) {
                if (subIndex.hasOwnProperty(key)) {
                    if (key == query) {
                        exactMatches.push({ "key": key, "articleIds": subIndex[key] });
                    }
                    else if (key.substr(0, qlen) == query) {
                        partialMatches.push({ "key": key, "articleIds": subIndex[key] });
                    }
                }
                if (partialMatches.length >= 100) {
                    break;
                }
            }
            var res = ""; // HTML result
            if (exactMatches.length) {
                var entry = exactMatches[0];
                res += "<b>" + IdoDictionaryUi.make_link(entry.key, entry.articleIds) + "</b>";
                var articleIds = entry.articleIds;
                this.load_articles(articleIds.join(","));
                if (partialMatches.length) {
                    res += " · ";
                }
            }
            else {
                IdoDictionaryUi.fade_articles();
            }
            if (partialMatches.length >= 100) {
                var len = partialMatches.length >= 100 ? "100+" : partialMatches.length;
                res += len + " matching words found";
            }
            else {
                var linksHtml = [];
                for (var i = 0; i < partialMatches.length; i++) {
                    var entry = partialMatches[i];
                    linksHtml.push(IdoDictionaryUi.make_link(entry.key, entry.articleIds));
                }
                res += linksHtml.join(" · ");
            }
            if (!res) {
                res = "No matching words found";
            }
            $("#words")[0].innerHTML = res;
            $("a.load_articles").click(function (event) { return _this.load_articles(event.target.getAttribute("articles")); });
            this.queryAsAlreadyProcessed = query;
        }
    };
    IdoDictionaryUi.prototype.load_articles = function (idsByComma) {
        var ids = idsByComma.split(",");
        this.articlesToDisplay = ids;
        var somethingLoaded = false;
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            if (!this[this.dir].articles[id]) {
                this.load_chunk_for_id(id);
            }
            else {
                somethingLoaded = true;
            }
        }
        $("#content").addClass("fade");
        if (somethingLoaded) {
            this.display_articles();
        }
    };
    IdoDictionaryUi.prototype.load_chunk_for_id = function (id) {
        var _this = this;
        var base = Math.floor(id / ARTICLES_PER_CHUNK) * ARTICLES_PER_CHUNK;
        $.get(this.dir + "/articles_" + base + ".json", function (data) {
            for (var i = 0; i < data.length; i++) {
                _this[_this.dir].articles[base + i] = data[i];
            }
            _this.display_articles();
        });
    };
    IdoDictionaryUi.fade_articles = function () {
        $("#content").addClass("fade");
    };
    IdoDictionaryUi.make_link = function (keyword, articleIds) {
        return '<a href="#" class="load_articles" articles="' + articleIds.join(",") + '">' + keyword + "</a>";
    };
    IdoDictionaryUi.prototype.display_articles = function () {
        var ids = this.articlesToDisplay;
        var res = [];
        var missingArticles = false;
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            var entry = this[this.dir].articles[id];
            if (entry) {
                res.push(entry);
            }
            else {
                missingArticles = true;
            }
        }
        $("#content")[0].innerHTML = res.join("<hr>");
        if (!missingArticles) {
            $("#content").removeClass("fade");
            $("b[fullkey~='" + this.queryAsAlreadyProcessed + "']").addClass("red");
        }
    };
    return IdoDictionaryUi;
}());
var app = new IdoDictionaryUi();
$(document).ready(function () { return app.main(); });
//# sourceMappingURL=ido_web_dict.js.map