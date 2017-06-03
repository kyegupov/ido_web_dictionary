package org.kyegupov.dictionary.tools

import org.yaml.snakeyaml.DumperOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.constructor.SafeConstructor
import org.yaml.snakeyaml.nodes.Tag
import org.yaml.snakeyaml.representer.Representer
import java.io.File
import java.io.FileWriter
import java.io.IOException
import java.nio.file.*
import java.nio.file.attribute.BasicFileAttributes

fun main(args : Array<String>) {

    writeJsonByLetters(Language.IDO, parseFiles(Language.IDO))
    writeJsonByLetters(Language.ENGLISH, parseFiles(Language.ENGLISH))
}

fun String.safePrefix(count: Int): String {
    return this.substring(0, Math.min(count, this.length));
}

//data class CompactArticle(
//        val text: String,
//        val keywords: Map<String, Double>
//)

fun compactize(article: Article) : String {
    return article.text.renderToHtml()
}

val YAML = {
    val dumperOptions = DumperOptions()
    val representer = Representer()
//    representer.addClassTag(CompactArticle::class.java, Tag.MAP)
    dumperOptions.isAllowReadOnlyProperties = true
    Yaml(SafeConstructor(), representer, dumperOptions)
}()

fun writeJsonByLetters(language: Language, parsingResults: ParsingResults) {

    val articles = parsingResults.articles

    val langLetter = language.toString().toLowerCase()[0]

    val targetPath = "src/main/resources/dyer_by_letter/$langLetter"

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

