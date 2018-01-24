package org.kyegupov.dictionary.tools

import org.kyegupov.dictionary.common.Direction
import org.kyegupov.dictionary.common.YAML
import java.io.File
import java.io.FileWriter
import java.nio.file.*

fun main(args : Array<String>) {

    writeJsonByLetters(Direction.IO_EN, parseDyerFiles(Direction.IO_EN))
    writeJsonByLetters(Direction.EN_IO, parseDyerFiles(Direction.EN_IO))
}

fun String.safePrefix(count: Int): String {
    return this.substring(0, Math.min(count, this.length));
}

fun compactize(article: Article) : String {
    return article.text.renderToHtml()
}

fun writeJsonByLetters(direction: Direction, parsingResults: ParsingResults) {

    val articles = parsingResults.articles

    val targetPath = "src/main/resources/dictionaries_by_letter/$direction"

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

