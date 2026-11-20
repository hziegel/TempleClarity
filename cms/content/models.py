"""Models for the Supabase tables the CMS edits.

Every model is `managed = False`: Django reads and writes these tables but never creates,
alters or drops them. Your schema.sql stays the single source of truth for the structure.
Only the columns the CMS needs are listed.
"""
from django.core.validators import MinValueValidator
from django.db import models


def to_minutes(delta):
    """timedelta -> a friendly number of minutes (5, 0.5, 90), or None."""
    if delta is None:
        return None
    minutes = delta.total_seconds() / 60
    return int(minutes) if minutes == int(minutes) else round(minutes, 2)


class Emotion(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255, unique=True)

    class Meta:
        managed = False
        db_table = "emotions"
        ordering = ["title"]

    def __str__(self):
        return self.title


class Genre(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255, unique=True)

    class Meta:
        managed = False
        db_table = "genres"
        ordering = ["title"]

    def __str__(self):
        return self.title


class Activity(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    min_time = models.DurationField(blank=True, null=True)
    max_time = models.DurationField(blank=True, null=True)
    screen_only = models.BooleanField(default=False)
    group_only = models.BooleanField(default=False)
    requires_supplies = models.BooleanField(default=False)
    published = models.BooleanField(default=False)
    created_at = models.DateTimeField(blank=True, null=True, editable=False)

    class Meta:
        managed = False
        db_table = "activities"
        ordering = ["title"]
        verbose_name_plural = "activities"

    def __str__(self):
        return self.title


class ActivityEmotion(models.Model):
    id = models.AutoField(primary_key=True)
    activity = models.ForeignKey(
        Activity, on_delete=models.CASCADE, db_column="activity_id", related_name="activity_emotions"
    )
    emotion = models.ForeignKey(
        Emotion, on_delete=models.CASCADE, db_column="emotion_id", related_name="activity_emotions"
    )
    relevance_score = models.IntegerField(
        default=1,
        validators=[MinValueValidator(0)],
        help_text="Higher = suggested sooner for this feeling. 0 = never suggested for it.",
    )

    class Meta:
        managed = False
        db_table = "activity_emotions"
        unique_together = [("activity", "emotion")]  # checked by the form; the table has no such rule

    def __str__(self):
        return f"{self.activity} / {self.emotion}: {self.relevance_score}"


class ActivityGenre(models.Model):
    id = models.AutoField(primary_key=True)
    activity = models.ForeignKey(
        Activity, on_delete=models.CASCADE, db_column="activity_id", related_name="activity_genres"
    )
    genre = models.ForeignKey(
        Genre, on_delete=models.CASCADE, db_column="genre_id", related_name="activity_genres"
    )

    class Meta:
        managed = False
        db_table = "activity_genres"

    def __str__(self):
        return f"{self.activity} / {self.genre}"


# The tables below are listed only so that deleting an activity also clears the rows that point
# at it (your schema has no ON DELETE CASCADE, so the database would otherwise refuse).
# They are not shown in the admin.
class Favorite(models.Model):
    id = models.AutoField(primary_key=True)
    activity = models.ForeignKey(
        Activity, on_delete=models.CASCADE, db_column="activity_id", related_name="favorites"
    )
    user_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = "favorites"


class Upvote(models.Model):
    id = models.AutoField(primary_key=True)
    activity = models.ForeignKey(
        Activity, on_delete=models.CASCADE, db_column="activity_id", related_name="upvotes"
    )
    user_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = "upvotes"


class Downvote(models.Model):
    id = models.AutoField(primary_key=True)
    activity = models.ForeignKey(
        Activity, on_delete=models.CASCADE, db_column="activity_id", related_name="downvotes"
    )
    user_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = "downvotes"


class SiteEvent(models.Model):
    id = models.AutoField(primary_key=True)
    # Kept for your usage statistics: deleting an activity only blanks the link.
    activity = models.ForeignKey(
        Activity,
        on_delete=models.SET_NULL,
        db_column="activity_id",
        related_name="site_events",
        blank=True,
        null=True,
    )

    class Meta:
        managed = False
        db_table = "site_events"
