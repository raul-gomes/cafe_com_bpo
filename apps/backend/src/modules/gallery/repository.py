"""
Gallery Module - Repository Layer

Data access for gallery items.
"""

from uuid import UUID

from sqlalchemy.orm import Session

from src.modules.gallery.models import CommonGalleryItem, GalleryItem

PRIVATE_DOWNLOAD_PREFIX = "/gallery/download/"
COMMON_DOWNLOAD_PREFIX = "/gallery/common/download/"


class GalleryRepository:
    """Repository for gallery item operations."""

    def __init__(self, session: Session):
        self.session = session

    def create(self, item_data: dict, user_id: UUID, file_url: str) -> GalleryItem:
        """Create a new gallery item."""
        item = GalleryItem(
            user_id=user_id,
            file_name=item_data.get("file_name"),
            file_path=file_url,
            file_type=item_data.get("file_type"),
            file_size=item_data.get("file_size"),
            title=item_data.get("title"),
            description=item_data.get("description"),
        )
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return item

    def get_by_id(self, item_id: UUID, user_id: UUID) -> GalleryItem | None:
        """Get a gallery item by ID for a specific user."""
        return (
            self.session.query(GalleryItem)
            .filter(GalleryItem.id == item_id, GalleryItem.user_id == user_id)
            .first()
        )

    def find_owned_download(self, user_id: UUID, filename: str) -> GalleryItem | None:
        """Returns the user's gallery row that points at `filename`, or `None`.

        This is the authorization for the download route: the row is what proves
        the file belongs to the caller. Resolving by filename on disk instead
        would serve anything left in the directory (failed upload, manual copy)
        to anyone who guessed the name.

        Args:
            user_id: Authenticated caller.
            filename: Stored filename (already reduced with `os.path.basename`).

        Returns:
            The owned gallery item, or `None` when the caller owns no such file.
        """
        return (
            self.session.query(GalleryItem)
            .filter(
                GalleryItem.user_id == user_id,
                GalleryItem.file_path == f"{PRIVATE_DOWNLOAD_PREFIX}{filename}",
            )
            .first()
        )

    def get_by_user(self, user_id: UUID) -> list[GalleryItem]:
        """Get all gallery items for a user."""
        return (
            self.session.query(GalleryItem)
            .filter(GalleryItem.user_id == user_id)
            .order_by(GalleryItem.created_at.desc())
            .all()
        )

    def update(self, item: GalleryItem, update_data: dict) -> GalleryItem:
        """Update a gallery item."""
        for key, value in update_data.items():
            if hasattr(item, key) and key not in [
                "file_path",
                "file_name",
                "file_type",
                "file_size",
            ]:
                setattr(item, key, value)
        self.session.commit()
        self.session.refresh(item)
        return item

    def delete(self, item: GalleryItem) -> None:
        """Delete a gallery item."""
        self.session.delete(item)
        self.session.commit()


class CommonGalleryRepository:
    """Repository for common gallery items."""

    def __init__(self, session: Session):
        self.session = session

    def list_all(self) -> list[CommonGalleryItem]:
        """List all common gallery items, newest first."""
        return (
            self.session.query(CommonGalleryItem)
            .order_by(CommonGalleryItem.created_at.desc())
            .all()
        )

    def create(self, data: dict, created_by: UUID) -> CommonGalleryItem:
        """Create a new common gallery item."""
        item = CommonGalleryItem(**data, created_by=created_by)
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return item

    def find_download(self, filename: str) -> CommonGalleryItem | None:
        """Returns the community row stored locally under `filename`, or `None`.

        Only locally stored rows match: files uploaded to Cloudinary keep the
        provider URL in `file_path` and are fetched straight from the CDN.

        Args:
            filename: Stored filename (already reduced with `os.path.basename`).

        Returns:
            The matching community item, or `None` when there is no local row.
        """
        return (
            self.session.query(CommonGalleryItem)
            .filter(
                CommonGalleryItem.file_path == f"{COMMON_DOWNLOAD_PREFIX}{filename}"
            )
            .first()
        )

    def get_by_id(self, item_id: UUID) -> CommonGalleryItem | None:
        """Get a common gallery item by ID."""
        return (
            self.session.query(CommonGalleryItem)
            .filter(CommonGalleryItem.id == item_id)
            .first()
        )

    def delete(self, item: CommonGalleryItem) -> None:
        """Delete a common gallery item."""
        self.session.delete(item)
        self.session.commit()
