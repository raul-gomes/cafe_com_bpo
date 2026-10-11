export interface AppNotificationResponse {
    id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    related_entity_type?: string;
    related_entity_id?: string;
    created_at: string;
}

export interface AppNotificationCreate {
    title: string;
    message: string;
    type: string;
    related_entity_type?: string;
    related_entity_id?: string;
}

export interface UnreadCountResponse {
    count: number;
}
