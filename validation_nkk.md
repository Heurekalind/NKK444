# Standortvalidator

[NKK444-Standorttool öffnen](./project-location-validator/index.html)

1. **Erfassen oder laden:** Zeichnen Sie einen Punkt, eine Linie oder eine Fläche. Das Formular zeigt Beispiele, zulässige Werte und Fehler direkt am Feld. Ein neuer Standort mit fehlerhaften Angaben wird nicht übernommen. Noch fehlende Berichtsphasen können Sie nacheinander ergänzen; bis dahin bleibt der Export gesperrt. Alternativ laden Sie GeoJSON, eine exportierte NKK444-Standortarbeitsmappe, die aktuelle Punkt-Excel-Vorlage oder drei mit GIS zusammengeführte GeoJSON-Dateien (eine pro Berichtsphase). Ein neuer Import ersetzt die Arbeitsliste nach Rückfrage.
2. **Prüfen und bearbeiten:** Wählen Sie einen Standort in der Liste oder auf der Karte. Die Standortdetails zeigen alle Attribute, Eingabehinweise und Prüfmeldungen. Dort können Sie Angaben ändern, Stützpunkte verschieben oder die Geometrie neu zeichnen. Das Lupensymbol in der Liste zoomt zum Standort. Fehler beim Lesen oder Zuordnen einer Vorlage müssen in der Quelldatei korrigiert werden.
3. **Filtern und speichern:** Kombinieren Sie Attributfilter, z. B. Zuschussnummer und Berichtsphase. Filter ändern nur die Darstellung, nicht die Prüfung oder den Export. Solange ein Fehler vorliegt, sind alle Exporte gesperrt. Nach erfolgreicher Prüfung lädt die Standardaktion ein ZIP mit GeoJSON (WGS84) und der erneut importierbaren Excel-Arbeitsmappe herunter.
4. **Einreichen:** Für die Einreichung steht zusätzlich EPSG:25832 zur Verfügung. Der E-Mail-Entwurf (`.eml`) enthält die Anlagen; öffnen Sie ihn im E-Mail-Programm und ergänzen Sie die Empfängeradresse. Der Validator sendet nichts automatisch.

Die Arbeitsliste bleibt bis zum Verlassen oder Neuladen der Seite im Browser. Exportieren Sie gültige Daten, bevor Sie die Seite schließen. Fachliche Einzelheiten stehen im [Datenmodell](./project_core_schema_nkk.md).

Als Hintergrund ist OpenStreetMap voreingestellt. Unter der Karte können Sie auf Esri-Satellitenbilder wechseln oder den Hintergrund ausschalten. Google Maps und Google Satellite öffnen den aktuellen Ausschnitt in einem neuen Tab, ohne Standortattribute zu übertragen.

Bei Problemen oder Funktionswünschen erstellen Sie bitte ein Ticket im [GitHub-Issue-Tracker](https://github.com/Heurekalind/NKK444/issues).
