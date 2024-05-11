import { getWorkOS } from '@embed/shared';

export const workos = getWorkOS();

export const DEFAULT_ORGANIZATION_NAME = 'My team';

export const RESERVED_COLLECTION_PROPERTIES = ['id', 'created_at', 'updated_at'];

export const DEFAULT_EMAIL_SUBSCRIPTIONS = ['security', 'billing', 'product_updates'];
