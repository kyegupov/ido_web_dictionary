package org.kyegupov.dictionary.tools

import java.io.FileWriter
import java.nio.file.Files
import java.nio.file.Paths
import java.util.*

fun main(args : Array<String>) {

    writeJsonShards(Language.IDO, parseFiles(Language.IDO))
    writeJsonShards(Language.ENGLISH, parseFiles(Language.ENGLISH))
}

fun writeJsonShards(language: Language, parsingResults: ParsingResults) {

    val allEntries = parsingResults.articles.map { it.text }
    val index = TreeMap<String, MutableMap<Int, Double>>()
    parsingResults.articles.forEachIndexed { i, entry ->
        entry.keywords.forEach { key ->
            index.getOrPut(key.value, {hashMapOf()}).put(i, key.weight)
        }
    }
    val compactIndex = TreeMap<String, List<Int>>()
    index.forEach { key, weightedEntryIndices -> compactIndex.put(key.toLowerCase(), weightedEntryIndices.entries.sortedBy { -it.value }.map{it.key})}

    val langLetter = language.toString().toLowerCase()[0]

    val targetPath = "src/main/resources/static_site/serverless_sharded_json//$langLetter"

    Files.createDirectories(Paths.get(targetPath))

    val keysByLetters = compactIndex.keys.groupBy { it[0] }

    for (keysByLetter in keysByLetters) {
        val jsonIndexBucket = GSON.toJson(compactIndex.subMap(keysByLetter.key + "", keysByLetter.key + "zzzzzzzzzz"))
        FileWriter(targetPath + "/index_${keysByLetter.key}.json").use {
            it.write(jsonIndexBucket)
        }
    }

    for (i in 0..allEntries.size-1 step 100) {
        FileWriter(targetPath + "/articles_$i.json").use {
            val upper = Math.min(i+100, allEntries.size)
            val slice = allEntries.subList(i, upper)
            val printableSlice = slice.map { entry -> entry.renderToHtml() }
            it.write(GSON.toJson(printableSlice))
        }
    }


}

