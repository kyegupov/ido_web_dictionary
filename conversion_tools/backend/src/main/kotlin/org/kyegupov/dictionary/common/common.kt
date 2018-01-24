package org.kyegupov.dictionary.common

import org.slf4j.LoggerFactory
import org.yaml.snakeyaml.DumperOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.constructor.SafeConstructor
import org.yaml.snakeyaml.representer.Representer

val YAML = {
    val dumperOptions = DumperOptions()
    val representer = Representer()
    dumperOptions.isAllowReadOnlyProperties = true
    Yaml(SafeConstructor(), representer, dumperOptions)
}()

val CLASS_LOADER = Thread.currentThread().contextClassLoader!!

val LOG = LoggerFactory.getLogger("ido-web-dictionary")!!

// Keys are in decreasing order of importance
data class Weighted<out T>(val value: T, val weight: Double)

enum class Language {
    ENGLISH,
    RUSSIAN,
    IDO
}

val languagesByCodes = mapOf(
    Pair("io", Language.IDO),
    Pair("en", Language.ENGLISH),
    Pair("ru", Language.RUSSIAN)
)

enum class Direction(val s: String) {
    IO_EN("io-en"),
    EN_IO("en-io"),
    IO_RU_IO("io-ru-io")
}

val languageToDirections = mapOf(
    Pair(Language.ENGLISH, listOf(Direction.IO_EN, Direction.EN_IO)), 
    Pair(Language.RUSSIAN, listOf(Direction.IO_RU_IO))
)
