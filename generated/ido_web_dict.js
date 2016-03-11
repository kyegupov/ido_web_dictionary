// Globals
// dir: direction of translation, either "i" or "e"
// e, i: dictionaries for directions, each has index and articles dictionaries
//     index dictionary is Map<Char, Map<String, Int>> - index integers grouped by key
//     articles dictionary is Map<Int, String>
// articlesToDisplay: list of article ids to display

window.ARTICLES_PER_CHUNK = 100

function main() {
    window.oldQuery = "";
    window.e = {index: {}, articles: {}}
    window.i = {index: {}, articles: {}}
    window.articlesToDisplay = []

    $("input:radio[name=direction]").click(function() {
        window.dir = $(this).val()[0];
        window.oldQuery = "";
        refresh_wordlist();
    });
    $("#searchbox").on("input", refresh_wordlist);
    $("input:radio[name=direction][value=ido-eng]").click();
}

function make_link(keyword, articleIds) {
    return "<a href=\"javascript:load_articles('"+articleIds.join(",")+"')\">"+keyword+"</a>";
}

function recursive_enumerate(prefix, trieNode, limit, results) {
    for (var key in trieNode) {
        var value = trieNode[key];
        if (value.constructor == Array) {
            results.push([prefix+key, value]);
        } else if (value!=="ext") {
            recursive_enumerate(prefix+key, value, limit, results);
        }
        if (results.length >= limit) break;
    }
}

function refresh_wordlist() {
    console.log("refresh_wordlist " )
    var query = $("#searchbox").val().toLowerCase().trim();
    if (query!=oldQuery && query!="") {
        var exactMatches = [];
        var partial = [];
        var partialMatches = [];

        var firstLetter = query.charAt(0);
        if (!/[a-z]/.test(firstLetter)) {
            return;
        }
        if (!window[window.dir][firstLetter]) {
            console.log("loading chunk " + firstLetter)
            $.get(dir + "/index_" + firstLetter + ".json", function(data) {
                window[dir][firstLetter] = data;
                console.log("loaded chunk " + firstLetter)
                refresh_wordlist();
            })
            window[dir][firstLetter] = {}; // Block subsequent requests
            return;
        }
        var subIndex = window[dir][firstLetter];

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

        var res = ""; // HTML result

        if (exactMatches.length) {
            var entry = exactMatches[0];
            res += "<b>" + make_link(entry.key, entry.articleIds) + "</b>";
            var articleIds = entry.articleIds;
            load_articles(articleIds.join(","));
            if (partialMatches.length) {
                res += " · ";
            }
        } else {
            fade_articles();
        }

        if (partialMatches.length>=100) {
            var len = partialMatches.length>=100 ? "100+" : partialMatches.length;
            res += len + " matching words found";
        } else {
            for (var i=0; i<partialMatches.length; i++) {
                var entry = partialMatches[i];
                partial.push(make_link(entry.key, entry.articleIds));
            }
            res += partial.join(" · ");
        }
        if (!res) {
            res = "No matching words found";
        }
        $("#words")[0].innerHTML = res;
        console.log("load don");
        oldQuery = query;
    }
}

function load_articles(idsByComma) {
    console.log("load_articles" + idsByComma);
    var ids = idsByComma.split(",");
    window.articlesToDisplay = ids;
    var somethingLoaded = false;
    for (var i=0; i<ids.length; i++) {
        var id = ids[i];
        if (!window[dir].articles[id]) {
            load_chunk_for_id(id);
        } else {
            somethingLoaded = true;
        }
    }
    $("#content").addClass("fade");
    if (somethingLoaded) {
        display_articles();
    }
}

function load_chunk_for_id(id) {
    var base = Math.floor(id/window.ARTICLES_PER_CHUNK) * window.ARTICLES_PER_CHUNK;
    $.get(dir + "/articles_" + base + ".json", function(data) {
        console.log("loaded " + base);
        for (var i = 0; i < data.length; i++) {
            window[dir].articles[base + i] = data[i];
        }
        display_articles();
    });
}

function fade_articles() {
    $("#content").addClass("fade");
}

function display_articles() {
    console.log("displaying")
    var ids = window.articlesToDisplay;
    var res = [];
    var missingArticles = false;
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var entry = window[dir].articles[id];
        if (entry) {
            res.push(entry);
        } else {
          missingArticles = true;
        }
    }
    $("#content")[0].innerHTML = res.join("<hr>");
    if (!missingArticles) {
        $("#content").removeClass("fade");
    }
}

$(document).ready(main);
