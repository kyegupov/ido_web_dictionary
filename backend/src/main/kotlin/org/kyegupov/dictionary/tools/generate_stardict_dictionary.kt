package org.kyegupov.dictionary.tools

import org.kyegupov.dictionary.common.languageToDirections
import org.kyegupov.dictionary.common.loadDataFromAlphabetizedShards
import java.io.DataOutputStream
import java.io.File
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Paths

fun main(args : Array<String>) {

    for ((_, directions) in languageToDirections) {
        for (direction in directions) {
            val data = loadDataFromAlphabetizedShards("dictionaries_by_letter/${direction.s}")

            val targetPath = "backend/src/main/resources/stardict/${direction.s}"
            File(targetPath).deleteRecursively()
            Files.createDirectories(Paths.get(targetPath))

            val dictFileStream = Files.newOutputStream(Paths.get(targetPath).resolve(direction.s + ".dict"))

            val idxData = mutableListOf<Pair<Int, Int>>()
            var offset = 0
            for (article in data.entries) {
                val bytes = article.toByteArray(StandardCharsets.UTF_8)
                dictFileStream.write(bytes)
                idxData.add(Pair(offset, bytes.size))
                offset += bytes.size
            }
            dictFileStream.close()

            val idxFileStream = DataOutputStream(Files.newOutputStream(Paths.get(targetPath).resolve(direction.s + ".idx")))
            val allWords = data.compactIndex.keys.sortedBy {
                // Emulate g_ascii_strcasecmp
                // TODO: better emulation
                it.toByteArray(StandardCharsets.US_ASCII).toString(StandardCharsets.US_ASCII).toLowerCase() }
            var idxSize = 0
            for (word in allWords) {
                val articleIds = data.compactIndex[word]!!
                for (articleId in articleIds) {
                    val wordBytes = word.toByteArray(StandardCharsets.UTF_8)
                    idxFileStream.write(wordBytes)
                    idxFileStream.write(0)
                    idxFileStream.writeInt(idxData[articleId].first)
                    idxFileStream.writeInt(idxData[articleId].second)
                    idxSize += wordBytes.size + 9
                }
            }
            idxFileStream.close()
            val ifoFileWriter = Files.newOutputStream(Paths.get(targetPath).resolve(direction.s + ".ifo")).writer(StandardCharsets.UTF_8)
            ifoFileWriter.write("""StarDict's dict ifo file
    version=3.0.0
    [options]
    bookname=$direction
    wordcount=${allWords.size}
    idxfilesize=${idxSize}
    sametypesequence=h
    """
            )
            ifoFileWriter.close()
        }
    }

}

