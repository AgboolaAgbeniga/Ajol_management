-- Add Foreign Key from publications to journals
ALTER TABLE publications 
ADD CONSTRAINT fk_publications_journals 
FOREIGN KEY (source_id) REFERENCES journals(source_id);

-- Add Foreign Key from authors to publications
ALTER TABLE authors 
ADD CONSTRAINT fk_authors_publications 
FOREIGN KEY (ajol_id) REFERENCES publications(id);

-- Add Foreign Key from keywords to publications
ALTER TABLE keywords 
ADD CONSTRAINT fk_keywords_publications 
FOREIGN KEY (ajol_id) REFERENCES publications(id);

-- Add Foreign Key from journal_areas to journals
ALTER TABLE journal_areas 
ADD CONSTRAINT fk_journal_areas_journals 
FOREIGN KEY (source_id) REFERENCES journals(source_id);
