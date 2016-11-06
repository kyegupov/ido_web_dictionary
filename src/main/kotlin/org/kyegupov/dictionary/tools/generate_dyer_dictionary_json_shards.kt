package org.kyegupov.dictionary.tools

import java.io.FileWriter
import java.nio.file.Files
import java.nio.file.Paths

fun main(args : Array<String>) {

    writeJsonShards(Language.IDO, parseFiles(Language.IDO))
    writeJsonShards(Language.ENGLISH, parseFiles(Language.ENGLISH))
}

fun writeJsonShards(language: Language, parsingResults: ParsingResults) {

    val compactIndex = parsingResults.compactIndex
    val allEntries = parsingResults.entries

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

