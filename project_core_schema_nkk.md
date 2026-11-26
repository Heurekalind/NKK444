# NKK444-Standortmodell

Die JSON-Schemas nutzen Draft 7 und richten sich nach dem GeoJSON-Feature-Aufbau des Project Location Model. Für unabhängige Prüfung die drei Dateien gemeinsam registrieren; Datumsformate müssen im Validator aktiviert sein.

| Schema | Inhalt |
|---|---|
| [FeatureCollection](./model/schema/feature_collection_schema_nkk.json) | Einreichung mit einem oder mehreren Standorten |
| [Feature](./model/schema/feature_project_schema_nkk.json) | Eine Punkt-, Flächen- oder Liniengeometrie und ihre Eigenschaften |
| [Projekt-Kernschema](./model/schema/project_core_schema_nkk.json) | Pflichtangaben, Wertebereiche, Maßnahmenkürzel und Berichtsphasen |

Ein Punkt-Feature beschreibt einen Baumstandort zu einem Berichtszeitpunkt. Ein Flächen-/Linien-Feature beschreibt eine Teilfläche zu einer Phase (`pre`, `post`, `prog`). Die Teilflächennummer (`subarea_number`) muss je Flächenbezeichner und Phase eindeutig sein. Ein `MultiPolygon` oder `MultiLineString` kann mehrere Geometriebestandteile **derselben** Teilfläche enthalten. Die Zahl der Teilflächen darf sich zwischen den Phasen ändern. Die Direkterfassung ist nicht auf sechs Teilflächen beschränkt.

Der Flächenbezeichner (`merge_id`) folgt dem Muster `Zuschussnummer_Maßnahmenkürzel_Jahr_Objektnummer`, z. B. `125_B2_2025_00007`. `nkk_objectnumber` hat fünf Stellen einschließlich führender Nullen. Das Kürzel `C` bezeichnet wie in den aktuellen Excel-Vorlagen die Maßnahme C.3.

## Import

- **NKK444-Standortarbeitsmappe:** Dateien aus dem Excel- oder ZIP-Export können erneut im Tool geladen werden. Das Blatt „Standorte“ enthält pro Feature eine Zeile mit den Attributen und der Geometrie als WGS84-JSON. Lange Geometrien verteilen sich auf mehrere Spalten. Bitte Titel, maschinenlesbare Kopfzeile und die Reihenfolge der Geometriespalten unverändert lassen. Punkte, Linien und Flächen können in derselben Arbeitsmappe stehen.
- **Punkt-Excel:** Das erste Arbeitsblatt muss in Zeile 6 die maschinenlesbaren Spalten der aktuellen Vorlage enthalten. Diese Vorlage enthält `start_intervention`, aber kein `report_date`. Beim Import ist deshalb ein Berichtszeitpunkt für die gesamte Datei anzugeben; für unterschiedliche Berichtszeitpunkte bitte getrennte Dateien verwenden. Der Validator berechnet den Flächenbezeichner und verwendet Längen- und Breitengrad als WGS84-Dezimalgrad.
- **Mit GIS verknüpfte Flächen-/Liniendaten:** Drei GeoJSON-Dateien mit den Attributen der jeweiligen Excel-Vorlage hochladen. Bei mehreren Teilflächen je Objekt entweder jede Geometrie ausdrücklich mit `subarea_number` zuordnen oder die Bestandteile eines `MultiPolygon`/`MultiLineString` in der Reihenfolge der Teilflächenspalten angeben. Andere GIS-Attribute werden dabei nicht ins NKK-Modell übernommen. Die tatsächlichen Vorlagenspalten für Anzahl, Datum und Biotopwerte werden berücksichtigt, einschließlich `report_date_post` in der Prognosevorlage und `biotope_grade1` in der Nachher-Vorlage. Ein fehlender Prognosetermin wird mit `2045-12-31` vorbelegt.
- **NKK444-GeoJSON:** Als Feature oder FeatureCollection importierbar. Ohne CRS-Angabe gilt WGS84 in der Reihenfolge `[Längengrad, Breitengrad]`. Für EPSG:25832 muss die Datei das CRS explizit deklarieren, z. B. `urn:ogc:def:crs:EPSG::25832`. Die Koordinaten werden vor Prüfung und Darstellung nach WGS84 umgerechnet.

## Prüfregeln und Export

Zusätzlich zum Schema prüft die Anwendung zusammenhängende Regeln: Flächenbezeichner, einfache Geometriegültigkeit (u. a. Ringschluss), Baumarten und Ausschlussliste, Biotopcodes und zugehörige Werte sowie die Vollständigkeit der drei Phasen je Flächenbezeichner. Die nach Teilflächengröße gewichteten Biotopwerte müssen von `pre` über `post` bis `prog` **ungerundet** strikt steigen. Bei Code `44.03.02J` stehen zwei Werte in der Referenzliste; der eingegebene Wert muss einer davon sein und wird im Prüfergebnis als Hinweis ausgewiesen. Nicht förderfähige Gehölze führen bei B.2 und B.3EB zu Fehlern, bei B.4 zu Hinweisen.

Der WGS84-Export entspricht dem NKK444-GeoJSON-Schema. Der separate Export für die Einreichung in ETRS89 / UTM Zone 32N enthält eine CRS-Kennung und metrische Koordinaten; er ist deshalb kein RFC-7946-GeoJSON. Die Prüftabelle fasst Baumarten bzw. Biotopangaben und gewichtete Werte je Phase zusammen. Der `.eml`-Entwurf enthält den projizierten Export, die Prüftabelle und eine aktuelle NKK444-Standortarbeitsmappe, bei unverändertem Punktimport zusätzlich die Originalvorlage. Die Anwendung verschickt keine Nachrichten.
