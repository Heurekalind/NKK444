# Standortvalidator

[NKK444-Standorttool öffnen](./project-location-validator/index.html)

1. **Erfassen oder laden:** Zeichnen Sie einen Punkt, eine Linie oder eine Fläche auf der Karte. Das Formular öffnet sich nach dem Zeichnen. Alternativ laden Sie NKK444-GeoJSON, eine exportierte NKK444-Standortarbeitsmappe, die aktuelle Punkt-Excel-Vorlage oder drei mit GIS zusammengeführte GeoJSON-Dateien (eine pro Berichtsphase). Ein neuer Import ersetzt die Arbeitsliste nach Rückfrage.
2. **Prüfen und bearbeiten:** Karte und Attributtabelle markieren denselben ausgewählten Standort. Das Lupensymbol zoomt darauf. Ändern Sie Attribute direkt in der Tabelle oder verschieben Sie Stützpunkte bzw. zeichnen Sie die Geometrie neu. Fehlende und ungültige Angaben werden sofort markiert. Fehler beim Lesen oder Zuordnen einer Vorlage müssen in der Quelldatei korrigiert werden.
3. **Filtern und speichern:** Kombinieren Sie Attributfilter, z. B. Zuschussnummer und Berichtsphase. Filter ändern nur die Darstellung, nicht die Prüfung oder den Export. Solange ein Fehler vorliegt, sind alle Exporte gesperrt. Nach erfolgreicher Prüfung lädt die Standardaktion ein ZIP mit GeoJSON (WGS84) und der erneut importierbaren Excel-Arbeitsmappe herunter.
4. **Einreichen:** Für die Einreichung steht zusätzlich EPSG:25832 zur Verfügung. Der E-Mail-Entwurf (`.eml`) enthält die Anlagen; öffnen Sie ihn im E-Mail-Programm und ergänzen Sie die Empfängeradresse. Der Validator sendet nichts automatisch.

Die Arbeitsliste bleibt bis zum Verlassen oder Neuladen der Seite im Browser. Exportieren Sie gültige Daten, bevor Sie die Seite schließen. Fachliche Einzelheiten stehen im [Datenmodell](./project_core_schema_nkk.md).

Bei Problemen oder Funktionswünschen erstellen Sie bitte ein Ticket im [GitHub-Issue-Tracker](https://github.com/Heurekalind/NKK444/issues).
