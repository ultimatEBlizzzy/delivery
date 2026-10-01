/**
 * Domain enums shared by backend (entities, DTO validation) and frontend (UI).
 * Values are stored as-is in PostgreSQL enum types, so treat renames as migrations.
 */

export enum Role {
  CUSTOMER = 'CUSTOMER',
  STORE = 'STORE',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum StoreStaffRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF',
}

/** Admin approval workflow for hardware stores. `isActive` is a separate on/off switch. */
export enum StoreStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** Driver account verification state. */
export enum DriverStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

/** Generic review outcome used for vehicles and uploaded documents. */
export enum VerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum VehicleType {
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
  BAKKIE = 'BAKKIE',
  PANEL_VAN = 'PANEL_VAN',
  TRUCK = 'TRUCK',
}

export enum DocumentType {
  ID_DOCUMENT = 'ID_DOCUMENT',
  DRIVERS_LICENCE = 'DRIVERS_LICENCE',
  PRDP = 'PRDP',
  VEHICLE_REGISTRATION = 'VEHICLE_REGISTRATION',
  ROADWORTHY_CERTIFICATE = 'ROADWORTHY_CERTIFICATE',
  PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',
  VEHICLE_PHOTO = 'VEHICLE_PHOTO',
  OTHER = 'OTHER',
}

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  STORE_ACCEPTED = 'STORE_ACCEPTED',
  PREPARING = 'PREPARING',
  READY_FOR_COLLECTION = 'READY_FOR_COLLECTION',
  DRIVER_REQUESTED = 'DRIVER_REQUESTED',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  COLLECTED = 'COLLECTED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CARD = 'CARD',
  EFT = 'EFT',
}

export enum PaymentProviderName {
  MOCK = 'MOCK',
  PAYFAST = 'PAYFAST',
  YOCO = 'YOCO',
}

export enum TransactionType {
  CHARGE = 'CHARGE',
  REFUND = 'REFUND',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum DeliveryStatus {
  SEARCHING_DRIVER = 'SEARCHING_DRIVER',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  AT_PICKUP = 'AT_PICKUP',
  COLLECTED = 'COLLECTED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum DeliveryOfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum DeliveryProofKind {
  COLLECTION = 'COLLECTION',
  DELIVERY = 'DELIVERY',
  SIGNATURE = 'SIGNATURE',
}

export enum NotificationEventType {
  ORDER_CREATED = 'ORDER_CREATED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  STORE_ACCEPTED_ORDER = 'STORE_ACCEPTED_ORDER',
  ORDER_READY = 'ORDER_READY',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  ORDER_COLLECTED = 'ORDER_COLLECTED',
  ORDER_IN_TRANSIT = 'ORDER_IN_TRANSIT',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  // Operational events beyond the customer-facing set
  NEW_ORDER_RECEIVED = 'NEW_ORDER_RECEIVED',
  DELIVERY_REQUEST = 'DELIVERY_REQUEST',
  DELIVERY_UNASSIGNED = 'DELIVERY_UNASSIGNED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  DISPUTE_UPDATED = 'DISPUTE_UPDATED',
  ACCOUNT_REVIEWED = 'ACCOUNT_REVIEWED',
  ADMIN_BROADCAST = 'ADMIN_BROADCAST',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum InventoryReason {
  INITIAL_STOCK = 'INITIAL_STOCK',
  RESTOCK = 'RESTOCK',
  ADJUSTMENT = 'ADJUSTMENT',
  CORRECTION = 'CORRECTION',
  SALE = 'SALE',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
}

export enum RatingTarget {
  DRIVER = 'DRIVER',
  STORE = 'STORE',
}

export enum ReviewStatus {
  VISIBLE = 'VISIBLE',
  HIDDEN = 'HIDDEN',
}

export enum DisputeType {
  WRONG_ITEM = 'WRONG_ITEM',
  DAMAGED_ITEM = 'DAMAGED_ITEM',
  MISSING_ITEM = 'MISSING_ITEM',
  LATE_DELIVERY = 'LATE_DELIVERY',
  OVERCHARGED = 'OVERCHARGED',
  DRIVER_CONDUCT = 'DRIVER_CONDUCT',
  STORE_CONDUCT = 'STORE_CONDUCT',
  OTHER = 'OTHER',
}

export enum DisputeStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum DiscountType {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export enum BroadcastAudience {
  ALL_CUSTOMERS = 'ALL_CUSTOMERS',
  ALL_DRIVERS = 'ALL_DRIVERS',
  ALL_STORES = 'ALL_STORES',
  USER = 'USER',
}
