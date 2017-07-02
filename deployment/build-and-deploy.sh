# Requires Java 8, Gradle 3+
# Also, install ido_dictionary.service via systemd
# and configure your nginx as per excerpt

# Run this from root of the repository

git pull
gradle shadowJar
mkdir -p /opt/ido_web_dictionary/
cp backend/build/libs/backend-all.jar /opt/ido_web_dictionary/ido_web_dictionary-jar-with-dependencies.jar
chmod go+rx -R /opt/ido_web_dictionary/
systemctl restart ido_dictionary

