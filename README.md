# NKK444
Inputs for Datavalidator NKK444

## Description of Excel Templates

The machine-readable column names are hidden in row six; row seven contains descriptive column names in german that can be removed, similar to the test row in the *Project Location Data* template.


### 1) NKK444_point_data_template.xlsx
This template is intended solely for recording point data, most of which is entered manually by users.

cols:
nkk_objectnumber(int max 5)  
grant_numbter (int 0 to 99999999)  
intervention_ident (B2;B3(Einzelbaumpflanzung);B4)  
report_date (date)  
species (any value, color flag in case exact equal to validation_value, excluded_plants)  
diameter (int 1 to 999)  
planting_year (int 1900 to 2999)  
plant_age (0 to 50)  
latitude (float -90 to 90)  
longitude (float -180 to 180)  

**Second sheet**
validation_values contains list of excluded_plants for flags in excel

### 2) NKK444_poly_data_template_pre.xlsx
### 2) NKK444_poly_data_template_post.xlsx
### 2) NKK444_poly_data_template_prog.xlsx
This template is used to capture polygon data. 

nkk_objectnumber(int max 5)  
grant_numbter (int 0 to 99999999)  
intervention_ident (A3;B3H;C1;C2;C;C4;C5;D2)  
report_date_pre (date)
report_date_post (date)
report_date_prog (date, autofill always 2045)
area_size ( int 1 to 99999999999999)
biotope_type ( validation_values -> bitope_codes)
bitope_grade_pre (int 0 to 24)
biotope_grade_post (int 0 to 24)
bitope_grade_prog (int 0 to 24)
mean_biotope_grade_pre (0 to 24)
mean_biotope_grade_prog ( 0 to 24)
biotope_grade_confirmation (TRUE biotoptype_grade_pre < biotopetype_grade_prog)
 (FALSE biotoptype_grade_pre > biotopetype_grade_prog)
latitude (float -90 to 90)  
longitude (float -180 to 180)  
merge_id (string, grant_number_intervention_ident)  

**Second sheet**
validation_values contains bitope codes

## Validator verification rules

### General 
Can be closely based on the FZ Locations.
All uploads should be checkt for:
- correct number of cols
- correct col names (nothing added, changed or removed)
- completness of row entries

### 1) NKK444_point_data_template.xlsx

- The Genus_species_global_tree_search_clean.csv provides allowed entries for the *species* column
- The excluded_plants.csv contains species that are not eligible for a grant.
- Check valid long lat columns

#### Error handeling/outputs

- If an entry in *species* is not on the list of Genus_species_global_tree_search_clean.csv print the entry and note " Bitte geben Sie den Gattungs und Artnamen nach den Bestimmungen aus der Dokumentation ein. Achten Sie auch auf Tippfehler."
- If an entry in *species* matches an entry in excluded_plants.csv print the entry and note "Die Liste nicht förderbarer Gehölze schließt die folgenden Einreichungen aus:**eintrag/einträge**.
  Bitte entfernen Sie diese aus dem Template und reichen nur förderbare Gehölze ein."
  
### 2) NKK444_poly_data_template.xlsx
- Three files must be submitted
- Number of actual geometries must match the number_subareas column.If the column is there.

## Map
Map of germany

## To be added 
NKK444_qgis_merge_instructions.pdf
- Create a project core schema for the NKK templates presumably based on json_schema_for_humans 
(german translation to be done by Heurekalind)
-PDF Guide for QGIS merge ( to be done by Heurekalind)
