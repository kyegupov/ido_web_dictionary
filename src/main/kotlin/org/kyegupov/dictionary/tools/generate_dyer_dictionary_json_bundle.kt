package org.kyegupov.dictionary.tools

import org.kyegupov.dictionary.common.Language
import java.io.FileWriter
import java.nio.file.Files
import java.nio.file.Paths
import java.util.*

fun main(args : Array<String>) {

    writeJsonCombined(Language.IDO, parseFiles(Language.IDO))
    writeJsonCombined(Language.ENGLISH, parseFiles(Language.ENGLISH))
}

fun writeJsonCombined(language: Language, parsingResults: ParsingResults) {

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

    val targetPath = "src/main/resources/dyer_bundle/$langLetter"

    Files.createDirectories(Paths.get(targetPath))

    FileWriter(targetPath + "/combined.json").use {
        it.write(GSON.toJson(mapOf(
                Pair("articles", allEntries.map { it.renderToHtml() }),
                Pair("index", compactIndex))))
    }

}

