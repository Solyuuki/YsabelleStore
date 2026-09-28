-- Expand category cover focal positioning from a horizontal anchor to a 3x3 grid.

ALTER TABLE `categories`
  MODIFY `cover_position`
    ENUM(
      'LEFT',
      'CENTER',
      'RIGHT',
      'TOP',
      'BOTTOM',
      'TOP_LEFT',
      'TOP_RIGHT',
      'BOTTOM_LEFT',
      'BOTTOM_RIGHT'
    )
    NOT NULL DEFAULT 'CENTER';

UPDATE `system_canonical_state`
SET `schema_version` = 4,
    `release_id` = 'g2-s4-c5-a2'
WHERE `id` = 1;
