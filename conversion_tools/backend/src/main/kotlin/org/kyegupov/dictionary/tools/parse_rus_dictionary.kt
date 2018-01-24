package org.kyegupov.dictionary.tools

import org.jsoup.Jsoup
import org.kyegupov.dictionary.common.Weighted
import org.kyegupov.dictionary.common.YAML
import java.io.File
import java.io.FileWriter
import java.nio.charset.Charset
import java.nio.file.FileSystems
import java.nio.file.Files
import java.nio.file.Paths

private fun positionToWeight(index: Int, size: Int): Double {
    return 1.0 - (1.0 * index / size)
}

fun parseRusFiles(): List<Article> {

    val pathMatcher = FileSystems.getDefault().getPathMatcher("glob:**/*.html")
    val sourceFiles = Files.list(Paths.get("backend/src/main/resources/rus_source")).filter { pathMatcher.matches(it) }.sorted()

    val articles = arrayListOf<Article>()

    for (f in sourceFiles) {

        val rawHtml = String(Files.readAllBytes(f), Charset.forName("UTF-8"))

//        require(!rawHtml.contains("&#"), {"entity in $f"})

        val doc = Jsoup.parse(rawHtml)
        val entries = doc.body().getElementsByTag("ul")[0].getElementsByTag("li")

        val newArticles = entries.map {
            val nonKeywordText = it.ownText().normalizeRuDictEntry()
            val reWordsWithMaybeParens = Regex("(?:[^(,]|\\([^(]+\\))+")
            val rusKeywords: List<String> = reWordsWithMaybeParens.findAll(nonKeywordText).
                    map { it.value.trimStart('-').trim() }.
                    toList()


            val idoKey = it.getElementsByTag("b")[0].text().trim().toLowerCase()
            val idoKeys = mutableListOf<String>()

            if (idoKey.contains("(")) {
                idoKeys.add(idoKey.replace(Regex("\\([^)]+\\)"), "").trim())
                idoKeys.add(idoKey.replace(Regex("[()]"), "").trim())
            } else {
                idoKeys.add(idoKey)
            }

            val allKeywords: List<String> = idoKeys.plus(rusKeywords)

            val textNodes: MutableList<RichTextNode> = listOf(KeywordNode(idoKey, idoKeys, true))
                    .plus(TextNode(": "))
                    .plus(rusKeywords.flatMap { listOf(KeywordNode(it, listOf(it), false), TextNode(", ")) })
                    .dropLast(1)
                    .toMutableList()

            // We only have io-ru articles, but they are keyed by both io and ru words
            Article(
                    ArticleText(textNodes),
                    allKeywords.mapIndexed { i, keyword ->
                        Weighted(keyword, positionToWeight(i, allKeywords.size))
                    }
            )
        }

        articles.addAll(newArticles)
    }

    return articles
}

private fun String.normalizeRuDictEntry(): String {
    return this
            .trim()
            .replace("( ", "(")
            .replace(Regex("([^ ])\\("), "$1 (" )
            .toLowerCase()
}

fun main(args : Array<String>) {

    writeRusJsonByLetters(parseRusFiles())
}

fun writeRusJsonByLetters(articles: List<Article>) {

    val targetPath = "backend/src/main/resources/dictionaries_by_letter/io-ru-io/"

    File(targetPath).deleteRecursively()
    Files.createDirectories(Paths.get(targetPath))

    val keysBy2Letters = articles.groupBy {it.keywords.sortedBy { -it.weight }[0].value.safePrefix(2).toLowerCase()}
    val keysBy3Letters = articles.groupBy {it.keywords.sortedBy { -it.weight }[0].value.safePrefix(3).toLowerCase()}

    for ((key2, value2) in keysBy2Letters) {
        if (value2.size < 300) {
            FileWriter(targetPath + "/${key2}.yaml").use {
                it.write(YAML.dump(value2.map(::compactize)))
            }
            println("$key2, ${value2.size}")
        } else {
            for ((key3, value3) in keysBy3Letters.filterKeys { it.startsWith(key2) }) {
                FileWriter(targetPath + "/${key3}.yaml").use {
                    it.write(YAML.dump(value3.map(::compactize)))
                    println("$key3, ${value3.size}")
                }
                println("$key3, ${value3.size}")
            }
        }
    }
}
