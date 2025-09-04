-- Create the cstkpr_opinions table for storing @cstkpr intelligence system opinions

CREATE TABLE IF NOT EXISTS cstkpr_opinions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_cast_hash TEXT NOT NULL,
  original_cast_content TEXT NOT NULL,
  original_author TEXT NOT NULL,
  topic_analysis TEXT[] DEFAULT '{}',
  related_saved_casts TEXT[] DEFAULT '{}',
  web_research_summary TEXT,
  opinion_text TEXT NOT NULL,
  confidence_score NUMERIC DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning TEXT[] DEFAULT '{}',
  sources_used TEXT[] DEFAULT '{}',
  response_tone TEXT CHECK (response_tone IN ('analytical', 'supportive', 'critical', 'curious', 'neutral')) DEFAULT 'neutral',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS cstkpr_opinions_cast_hash_idx ON cstkpr_opinions(original_cast_hash);
CREATE INDEX IF NOT EXISTS cstkpr_opinions_author_idx ON cstkpr_opinions(original_author);
CREATE INDEX IF NOT EXISTS cstkpr_opinions_created_at_idx ON cstkpr_opinions(created_at DESC);
CREATE INDEX IF NOT EXISTS cstkpr_opinions_confidence_idx ON cstkpr_opinions(confidence_score DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_cstkpr_opinions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER update_cstkpr_opinions_updated_at
  BEFORE UPDATE ON cstkpr_opinions
  FOR EACH ROW
  EXECUTE FUNCTION update_cstkpr_opinions_updated_at();

-- Add RLS (Row Level Security) if needed
-- ALTER TABLE cstkpr_opinions ENABLE ROW LEVEL SECURITY;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON cstkpr_opinions TO authenticated;
-- GRANT ALL ON cstkpr_opinions TO anon;
