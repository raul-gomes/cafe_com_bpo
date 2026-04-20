export interface NotificationResponse {
    id: string;
    user_id: string;
    type: string;
    post_id: string;
    comment_id: string;
    triggered_by_user_id: string;
    is_read: boolean;
    read_at?: string;
    created_at: string;
}

export interface PaginatedNotifications {
    items: NotificationResponse[];
    total: number;
}
