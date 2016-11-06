package org.kyegupov.dictionary.tools

import java.io.FileWriter
import java.nio.file.Files
import java.nio.file.Paths

fun main(args : Array<String>) {

    writeJsonCombined(Language.IDO, parseFiles(Language.IDO))
    writeJsonCombined(Language.ENGLISH, parseFiles(Language.ENGLISH))
}

fun writeJsonCombined(language: Language, parsingResults: ParsingResults) {

    val compactIndex = parsingResults.compactIndex
    val allEntries = parsingResults.entries

    val langLetter = language.toString().toLowerCase()[0]

    val targetPath = "src/main/resources/dyer_bundle/$langLetter"

    Files.createDirectories(Paths.get(targetPath))

    FileWriter(targetPath + "/combined.json").use {
        it.write(GSON.toJson(mapOf(
                Pair("articles", allEntries.map { it.renderToHtml() }),
                Pair("index", compactIndex))))
    }

}

