from datetime import timedelta

from django import forms
from django.contrib import admin, messages
from django.utils import timezone

from .models import Activity, ActivityEmotion, ActivityGenre, Emotion, Genre, to_minutes

admin.site.site_header = "Temple Clarity"
admin.site.site_title = "Temple Clarity CMS"
admin.site.index_title = "Add and edit activities"


class ActivityForm(forms.ModelForm):
    description = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 6, "cols": 80}),
        help_text="Shown on the card. Plain text.",
    )
    min_minutes = forms.FloatField(
        min_value=0,
        label="Shortest time (minutes)",
        help_text="Fractions are fine: 0.5 is thirty seconds.",
    )
    max_minutes = forms.FloatField(
        min_value=0,
        label="Longest time (minutes)",
        help_text="The card shows this one. Use the same number twice for a fixed time.",
    )
    genres = forms.ModelMultipleChoiceField(
        queryset=Genre.objects.none(), required=False, widget=forms.CheckboxSelectMultiple
    )

    class Meta:
        model = Activity
        fields = ["title", "description", "published", "screen_only", "group_only", "requires_supplies"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["genres"].queryset = Genre.objects.order_by("title")
        activity = self.instance
        if activity is not None and activity.pk:
            self.initial["min_minutes"] = to_minutes(activity.min_time)
            self.initial["max_minutes"] = to_minutes(activity.max_time)
            self.initial["genres"] = list(activity.activity_genres.values_list("genre_id", flat=True))

    def clean_title(self):
        title = " ".join(self.cleaned_data["title"].split())
        clash = Activity.objects.filter(title__iexact=title)
        if self.instance.pk:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise forms.ValidationError("An activity with this title already exists.")
        return title

    def clean(self):
        cleaned = super().clean()
        low, high = cleaned.get("min_minutes"), cleaned.get("max_minutes")
        if low is not None and high is not None and high < low:
            self.add_error("max_minutes", "The longest time can't be shorter than the shortest.")
        if low is not None:
            self.instance.min_time = timedelta(minutes=low)
        if high is not None:
            self.instance.max_time = timedelta(minutes=high)
        return cleaned


class ActivityEmotionInline(admin.TabularInline):
    model = ActivityEmotion
    extra = 2
    fields = ("emotion", "relevance_score")
    verbose_name = "emotion weight"
    verbose_name_plural = "Emotions and weights (higher = suggested sooner; 0 = never; leave an emotion out if it doesn't fit)"


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    form = ActivityForm
    inlines = [ActivityEmotionInline]
    fieldsets = (
        (None, {"fields": ("title", "description", "published")}),
        ("How long it takes", {"fields": ("min_minutes", "max_minutes")}),
        ("Needs", {"fields": ("screen_only", "group_only", "requires_supplies")}),
        ("Genres", {"fields": ("genres",)}),
    )
    list_display = ("title", "published", "time_range", "emotion_weights", "genre_names")
    list_editable = ("published",)
    list_filter = ("published", "screen_only", "group_only", "requires_supplies")
    search_fields = ("title", "description")
    ordering = ("title",)
    list_per_page = 50
    save_on_top = True
    actions = ["publish_selected", "unpublish_selected"]

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related(
            "activity_emotions__emotion", "activity_genres__genre"
        )

    @admin.display(description="Time")
    def time_range(self, obj):
        low, high = to_minutes(obj.min_time), to_minutes(obj.max_time)
        if low is None and high is None:
            return "-"
        return f"{low if low is not None else '?'}–{high if high is not None else '?'} min"

    @admin.display(description="Emotions (weight)")
    def emotion_weights(self, obj):
        rows = sorted(obj.activity_emotions.all(), key=lambda r: (-r.relevance_score, r.emotion.title))
        return ", ".join(f"{r.emotion.title} {r.relevance_score}" for r in rows) or "-"

    @admin.display(description="Genres")
    def genre_names(self, obj):
        return ", ".join(sorted(r.genre.title for r in obj.activity_genres.all())) or "-"

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_at:
            obj.created_at = timezone.now()
        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        # The quick "published" checkboxes on the list page use a form without genres; leave
        # the genre links alone for those.
        if "genres" not in form.cleaned_data:
            return
        # Genres are checkboxes on the form; keep the activity_genres rows in step with them.
        activity = form.instance
        wanted = {genre.pk for genre in form.cleaned_data["genres"]}
        existing = set(ActivityGenre.objects.filter(activity=activity).values_list("genre_id", flat=True))
        ActivityGenre.objects.filter(activity=activity).exclude(genre_id__in=wanted).delete()
        for genre_id in sorted(wanted - existing):
            ActivityGenre.objects.create(activity=activity, genre_id=genre_id)

    @admin.action(description="Publish selected activities")
    def publish_selected(self, request, queryset):
        count = queryset.update(published=True)
        self.message_user(request, f"Published {count} activit{'y' if count == 1 else 'ies'}.", messages.SUCCESS)

    @admin.action(description="Unpublish selected activities (hide from the site)")
    def unpublish_selected(self, request, queryset):
        count = queryset.update(published=False)
        self.message_user(request, f"Unpublished {count} activit{'y' if count == 1 else 'ies'}.", messages.SUCCESS)


class LowercaseTitleForm(forms.ModelForm):
    """Emotion titles are stored in lowercase, matching how you enter them by hand."""

    class Meta:
        model = Emotion
        fields = ["title"]

    def clean_title(self):
        title = " ".join(self.cleaned_data["title"].split()).lower()
        clash = Emotion.objects.filter(title__iexact=title)
        if self.instance.pk:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise forms.ValidationError("That emotion already exists.")
        return title


@admin.register(Emotion)
class EmotionAdmin(admin.ModelAdmin):
    form = LowercaseTitleForm
    list_display = ("title",)
    search_fields = ("title",)


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):
    list_display = ("title",)
    search_fields = ("title",)
