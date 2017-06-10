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
