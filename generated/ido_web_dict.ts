/// <reference path="jquery.d.ts" />

const ARTICLES_PER_CHUNK = 100;

type IndexSegment = { [word: string]: Array<number>}

class DictionaryData {
    index: { [letter: string]: IndexSegment }
    articles: { [id: number]: string }
}

interface Match {
    key: string;
    articleIds: Array<string>;
}

class IdoDictionaryUi {
    queryAsAlreadyProcessed: string = ""; // previous query
    e: DictionaryData; // english -> ido
    i: DictionaryData; // ido -> english
    articlesToDisplay: Array<number>; // list of ids
    dir: string; // direction of translation, either "i" or "e"

    main() {
        this.queryAsAlreadyProcessed = "";
        this.e = {index: {}, articles: {}}
        this.i = {index: {}, articles: {}}
        this.articlesToDisplay = [];

        $("input:radio[name=direction]").click((event) => {
            this.dir = $(event.target).val()[0];
            this.queryAsAlreadyProcessed = "";
            this.refresh_wordlist();
        });
        $("#searchbox").on("input", () => this.refresh_wordlist());
        $("input:radio[name=direction][value=ido-eng]").click();
    }

    refresh_wordlist() {
        var query = $("#searchbox").val().toLowerCase().trim();
        if (query != this.queryAsAlreadyProcessed && query!="") {
            this.queryAsAlreadyProcessed = query;
            $("b").removeClass("red");
            var exactMatches: Array<Match> = [];
            var partialMatches: Array<Match> = [];

            var firstLetter = query.charAt(0);
            if (!/[a-z]/.test(firstLetter)) {
                return;
            }

            var dictionary = this[this.dir];

            if (!dictionary[firstLetter]) {
                $.get(this.dir + "/index_" + firstLetter + ".json", (data) => {
                    this[this.dir][firstLetter] = data;
                    this.refresh_wordlist();
                });
                this[this.dir][firstLetter] = {}; // Block subsequent requests
                return;
            }
            var subIndex = dictionary[firstLetter];

            var qlen = query.length;

            for (var key in subIndex) {
                if (subIndex.hasOwnProperty(key)) {
                    if (key == query) {
                        exactMatches.push({"key": key, "articleIds": subIndex[key]})
                    } else if (key.substr(0, qlen) == query) {
                        partialMatches.push({"key": key, "articleIds": subIndex[key]})
                    }
                }
                if (partialMatches.length>=100) {
                    break;
                }
            }

            var res: string = ""; // HTML result

            if (exactMatches.length) {
                var entry = exactMatches[0];
                res += "<b>" + IdoDictionaryUi.make_link(entry.key, entry.articleIds) + "</b>";
                var articleIds = entry.articleIds;
                this.load_articles(articleIds.join(","));
                if (partialMatches.length) {
                    res += " · ";
                }
            } else {
                IdoDictionaryUi.fade_articles();
            }

            if (partialMatches.length>=100) {
                var len = partialMatches.length>=100 ? "100+" : partialMatches.length;
                res += len + " matching words found";
            } else {
                var linksHtml: Array<string> = [];
                for (var i=0; i<partialMatches.length; i++) {
                    var entry = partialMatches[i];
                    linksHtml.push(IdoDictionaryUi.make_link(entry.key, entry.articleIds));
                }
                res += linksHtml.join(" · ");
            }
            if (!res) {
                res = "No matching words found";
            }
            $("#words")[0].innerHTML = res;
            $("a.load_articles").click((event) => this.load_articles(event.target.getAttribute("articles")));
            this.queryAsAlreadyProcessed = query;
        }
    }


    load_articles(idsByComma) {
        var ids = idsByComma.split(",");
        this.articlesToDisplay = ids;
        var somethingLoaded = false;
        for (var i=0; i<ids.length; i++) {
            var id = ids[i];
            if (!this[this.dir].articles[id]) {
                this.load_chunk_for_id(id);
            } else {
                somethingLoaded = true;
            }
        }
        $("#content").addClass("fade");
        if (somethingLoaded) {
            this.display_articles();
        }
    }

    load_chunk_for_id(id) {
        var base = Math.floor(id/ARTICLES_PER_CHUNK) * ARTICLES_PER_CHUNK;
        $.get(this.dir + "/articles_" + base + ".json", (data) => {
            for (var i = 0; i < data.length; i++) {
                this[this.dir].articles[base + i] = data[i];
            }
            this.display_articles();
        });
    }

    static fade_articles() {
        $("#content").addClass("fade");
    }

    static make_link(keyword, articleIds) {
        return '<a href="#" class="load_articles" articles="' + articleIds.join(",") + '">' + keyword + "</a>";
    }

    display_articles() {
        var ids = this.articlesToDisplay;
        var res = [];
        var missingArticles = false;
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            var entry = this[this.dir].articles[id];
            if (entry) {
                res.push(entry);
            } else {
                missingArticles = true;
            }
        }
        $("#content")[0].innerHTML = res.join("<hr>");
        if (!missingArticles) {
            $("#content").removeClass("fade");
            $("b[fullkey~='" + this.queryAsAlreadyProcessed +"']").addClass("red");
        }
    }

}


var app = new IdoDictionaryUi();

$(document).ready(() => app.main());
