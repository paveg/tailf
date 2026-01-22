-- Add topic columns for automatic topic assignment
-- main_topic: Primary topic (highest keyword score)
-- sub_topic: Secondary topic (second highest score, optional)

ALTER TABLE posts ADD COLUMN main_topic TEXT;
ALTER TABLE posts ADD COLUMN sub_topic TEXT;

-- Create indexes for efficient topic filtering
CREATE INDEX posts_main_topic_idx ON posts(main_topic);
CREATE INDEX posts_sub_topic_idx ON posts(sub_topic);
