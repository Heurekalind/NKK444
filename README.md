# NKK444
**README Contents and Structure:**
- The first section is based on the input being Excel templates/merged Geojson in accordance with the FZ Location workflow.
- The second section contains a description of the input requirements and the logic governing how input and validation are to be carried out for direct data input into the online validator tool. (New validator feature)
- All referenced error codes are marked bold and can be found in the chapter *Error handling/outputs*

**General notes:**
- I see a submission based on a database query carried out by local authorities as problematic, as there are differences in biotope type codes and classifications across the various federal states.
Wherever possible, the submission of biotope type codes that do not comply with "BKompV Anlage 2"  should be avoided.
- The BfN requests ETRS89 / UTM Zone 32N (EPSG: 25832)
The MD files containing the user information are currently based solely on the Excel upload. I would like to take a look at the new validation tool first before adding or amending the descriptions accordingly.

# Part 1. Excel/Geojson upload

## Description of Excel Templates
The machine-readable column names are hidden in row six; row seven contains descriptive column names in german that should be used for error handeling.

### 1) NKK444_point_data_template.xlsx
This template is intended solely for recording point data, most of which is entered manually by users.

cols:
nkk_objectnumber(int max 5)  
grant_numbter (int 0 to 99999999)  
intervention_ident (B2;B3EB;B4)  
report_date (date)  
species (any value, excel obtains color flag in case exact equal to validation_value, excluded_plants)  
diameter (int 1 to 999)  
planting_year (int 1900 to 2999)  
plant_age (0 to 50)  
latitude (float -90 to 90)  
longitude (float -180 to 180)  

**Second sheet**
validation_values contains list of excluded_plants for flags in excel

### 2) NKK444 Polygon Templates 
This template is intended exclusively for the recording of polygon data. 
I belive it to be preferable for local authorities if direct input were the primary method for submitting polygon data.
The project area might be subdivided into sub-areas with different biotope classes and codes as the project is implemented.
For comparison, a weighted average is calculated for the sub-areas in the Excel file.
To ensure ease of use, only six sub-areas can be entered in the Excel file.
Depending on user behaviour

#### a) NKK444_poly_data_template_pre.xlsx
nkk_objectnumber(int max 5)  
grant_numbter (int 0 to 99999999)  
intervention_ident (A3;B3H;C1;C2;C;C4;C5;D2)
start_intervention (int 2017 to 2070)  
report_date_pre (date)  
area_size ( int 1 to 99999999999999)  
biotope_code_pre = lookup(validation_values, biotope_codes)  
biotope_grade_pre = lookup(validation_values, biotope_codes according to bitope_grade_pre)  
merge_id (string, "grant_number"_ "intervention_ident" _ "start_intervention"_ "nkk_objectnumber")   

#### b) NKK444_poly_data_template_post.xlsx
nkk_objectnumber(int max 5)   
grant_numbter (int 0 to 99999999)  
intervention_ident (A3;B3H;C1;C2;C;C4;C5;D2)  
start_intervention (int 2017 to 2070)  
report_date_post (date)  
area_size_post1 to 6 ( int 1 to 99999999999999)  
biotope_code_post1 to 6 = lookup(validation_values, biotope_codes)  
biotope_grade_post1 to 6 = lookup(validation_values, biotope_codes according to bitope_grade_post)  
merge_id (string, "grant_number"_ "intervention_ident" _ "start_intervention"_ "nkk_objectnumber")   

#### c) NKK444_poly_data_template_prog.xlsx
nkk_objectnumber(int max 5)  
grant_numbter (int 0 to 99999999)  
intervention_ident (A3;B3H;C1;C2;C;C4;C5;D2)  
start_intervention (int 2017 to 2070)  
report_date_prog (date)  
area_size_prog1 to 6 ( int 1 to 99999999999999)  
biotope_code_prog1 to 6 = lookup(validation_values, biotope_codes)  
biotope_grade_prog1 to 6 = lookup(validation_values, biotope_codes according to bitope_grade_prog)  
merge_id (string, "grant_number"_ "intervention_ident" _ "start_intervention"_ "nkk_objectnumber")    

**Second sheet**
validation_values contains bitope_codes and biotope_grades

## Validator verification 

### General 
Can be closely based on the FZ Locations.
Note: not all subarea columns have to be filled in.
All uploads should be checkt for:
- correct number of cols **Error_d)**
- correct col names (nothing added, changed or removed) **Error_d)**
- completness of row entries **Error_c)**

### 1) NKK444_point_data_template.xlsx

- The Genus_species_global_tree_search_clean.csv provides allowed entries for the *species* column
- The excluded_plants.csv contains species that are not eligible for a grant.
- Check valid long lat columns
  
### 2) NKK444_poly_data_template.xlsx
- Three files must be submitted one for each date.
- Number of actual geometries must match the number_subareas column within each file.
  	- Only File two and three contain subareas.
- The number of subareas 1 to 6 as well as biotope_code 1 to 6 need to match the entry in number_subareas  
- The grades / mean grades need follow  
	- grade_pre < mean_grade_post  
	- mean_grade_post < mean_grade_prog  

# Part 2. Direct input

## General 
- Basemap of Germany searchable by city, street name, and ZIP code
- Drawing points and multipolygons
- Auto-zoom on uploaded objects
- The data should be sent via automated draft email to the administrator,
  as they need to carry out additional checks before the data can be provided to the BfN (via ODP?)
- All the inputs listed are compulsory
- All frontend inputdescriptions and column names should be in german and in accordance with the excel template

## Point Data Inputs and logic - Direct Input 

- nkk_objectnumber(int max 5)  
- grant_numbter (int 0 to 99999999)  
- intervention_ident (B2;B3EB;B4) 
- report_date (date)

- species
Must match at least one entry in Genus_species_global_tree_search_clean.csv (∃)  
if FALSE → **Error_a**  
if TRUE → continue  
Then ensure species must not match any entry in excluded_plants.csv (∄)  
if TRUE  → **Error_b** (ForbiddenMatch)  
if FALSE  → pass   

- diameter (int 1 to 999)  
- planting_year (int 1900 to 2999) 
- plant_age (0 to 50)  
- latitude (float -90 to 90)  
- longitude (float -180 to 180)  

## Polydata Inputs and logic - Direct Input 
- nkk_objectnumber(string max 5 with leading 0s)  
- grant_number (int 0 to 99999999)  
- intervention_ident (A3;B3H;C1;C2;C;C4;C5;D2) 

- report_date_pre (date)
- report_date_post (date)
- report_date_prog (date, autofill always 2045)

Area/s in sqm
Area _size_pre can split during intervention into x sub-areas
- area_size_pre ( int 1 to 99999999999999) 
	sum(sub_area_size_pre) == area_size_pre
- area_size_post ( int 1 to 99999999999999)
	sum(sub_area_size_post) == area_size_pre
- area_size_prog ( int 1 to 99999999999999)
	sum(sub_area_size_prog) == area_size_pre

- biotope_code (for each area/subareas)
- biotope_grade = lookup(biotope_codes.csv)

In case the original area splits during intervention the weighted mean of the biotope grades, for the subareas is to be calculated.  
grade_mean = sum(grade_i * subarea_i) / sum(subarea_i) 

The grades / mean grades need follow 
- grade_pre < mean_grade_post
- mean_grade_post < mean_grade_prog

- merge_id (string, "grant_number"_"intervention_ident"_"start_intervention"_"nkk_objectnumber") 
Does not identify subareas.

## Outputs/ Generated Email

The generated Email should contain:
1. Email Text *nkk_email_template.md*
2. Generated/ validated Geojson  
3a) Validated Excel Template  
3b) In case of direct input a table of *merge_id* + validated items, either:
- *species*
- *area_size, biotope_codes, biotope_grades* including *pre,post,prog* and *subareas*
  
File naming convention for attachments:  
"grant_number"_"intervention_ident"_"start_intervention"_"date".extension

## Error handeling/outputs

- Error_a) Print the entry and note *" Bitte geben Sie den Gattungs und Artnamen nach den Bestimmungen aus der Dokumentation ein. Achten Sie auch auf Tippfehler."*
- Error_b) Print the entry and note *"Die Liste nicht förderbarer Gehölze schließt die folgenden Einreichungen aus:* **species ForbiddenMatch**.
  *Bitte entfernen Sie diese aus dem Template und reichen nur förderbare Gehölze ein."*
- Error_c) Print colname and row *"Bitte prüfen Sie Ihre Eingabe entsprechend der Eingabebestimmungen"*
- Error_d) Print *"Die Eingereichte Datei entspricht nicht der Vorlage."*

## To be added 
- PDF Guide for QGIS merge NKK444_qgis_merge_instructions.pdf ( to be done by Heurekalind)

# Visualisations

<img width="388" height="356" alt="image" src="https://github.com/user-attachments/assets/bad3c0d7-470c-43db-9960-927ced489ffa" />


