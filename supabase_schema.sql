-- Create Journals table
CREATE TABLE journals (
    source_id TEXT PRIMARY KEY,
    source_title TEXT,
    country TEXT,
    issn_print TEXT,
    issn_online TEXT,
    source_url TEXT
);

-- Create Publications table
CREATE TABLE publications (
    id TEXT PRIMARY KEY,
    article_url TEXT,
    doi TEXT,
    source_id TEXT,
    issue TEXT,
    volume TEXT,
    date TEXT,
    year INTEGER,
    title TEXT,
    first_page TEXT,
    last_page TEXT
);

-- Create Authors table
CREATE TABLE authors (
    id BIGSERIAL PRIMARY KEY,
    ajol_id TEXT,
    author TEXT
);

-- Create Keywords table
CREATE TABLE keywords (
    id BIGSERIAL PRIMARY KEY,
    ajol_id TEXT,
    keyword TEXT
);

-- Create Journal Areas table
CREATE TABLE journal_areas (
    id BIGSERIAL PRIMARY KEY,
    source_id TEXT,
    area TEXT
);

-- Indexes for performance
CREATE INDEX idx_publications_source_id ON publications(source_id);
CREATE INDEX idx_authors_ajol_id ON authors(ajol_id);
CREATE INDEX idx_keywords_ajol_id ON keywords(ajol_id);
CREATE INDEX idx_journal_areas_source_id ON journal_areas(source_id);
