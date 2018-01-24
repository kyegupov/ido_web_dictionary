package org.kyegupov.dictionary.common

import org.jsoup.Jsoup
import java.io.InputStreamReader
import java.io.BufferedReader
import java.nio.file.*
import java.util.*
import java.util.stream.Collectors

data class DictionaryOfStringArticles(
        val entries: List<String>,
        val compactIndex: TreeMap<String, List<Int>>
)

var JAR_FS: FileSystem? = null

// https://stackoverflow.com/a/28057735
fun listResources(path: String): List<Path> {
    println(path)
    val uri = CLASS_LOADER.getResource(path).toURI()

    val myPath: Path
    if (uri.scheme == "jar") {
        if (JAR_FS == null) {
            JAR_FS = FileSystems.newFileSystem(uri, Collections.emptyMap<String, Any>())
        }
        myPath = JAR_FS!!.getPath(path)
    } else {
        myPath = Paths.get(uri)
    }
    return Files.walk(myPath, 1).skip(1).collect(Collectors.toList())
}

fun loadDataFromAlphabetizedShards(path: String) : DictionaryOfStringArticles {
    val allArticles = mutableListOf<String>()
    for (resource in listResources(path).sorted().filter{it.toString().endsWith(".txt")}) {
        LOG.info("Reading shard $resource")
        Files.newInputStream(resource).use {
            val reader = BufferedReader(InputStreamReader(it))
            var accumulator = ""
            while (reader.ready()) {
                val line = reader.readLine()
                if (line == "") {
                    allArticles.add(accumulator)
                    accumulator = ""
                } else {
                    if (accumulator != "") {
                        accumulator += " ";
                    }
                    accumulator += line
                }
            }
            if (accumulator != "") {
                allArticles.add(accumulator)
            }
        }
    }
    LOG.info("Building index")
    return DictionaryOfStringArticles(
            entries = allArticles,
            compactIndex = buildIndex(allArticles))
}

private fun positionToWeight(index: Int, size: Int): Double {
    return 1.0 - (1.0 * index / size)
}

fun buildIndex(articles: MutableList<String>): TreeMap<String, List<Int>> {

    val index = TreeMap<String, MutableMap<Int, Double>>()

    articles.forEachIndexed { i, entry ->
        val html = Jsoup.parse(entry)
        val keywords = html.select("[dict-key]").flatMap {it.attr("dict-key").split(',')}
        val weightedKeywords = keywords.mapIndexed{ki, kw -> Weighted(kw, positionToWeight(ki, keywords.size)) }

        weightedKeywords.forEach { (value, weight) ->
            index.getOrPut(value, {hashMapOf()}).getOrPut(i, {weight})
        }
    }
    val compactIndex = TreeMap<String, List<Int>>()
    index.forEach { key, weightedEntryIndices ->
        compactIndex.put(key.toLowerCase(), weightedEntryIndices.entries.sortedBy { -it.value }.map{it.key})}

    return compactIndex
}
