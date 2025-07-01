-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'team_lead', 'developer', 'viewer') NOT NULL DEFAULT 'viewer',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teams` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `teams_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_memberships` (
    `user_id` VARCHAR(36) NOT NULL,
    `team_id` VARCHAR(36) NOT NULL,
    `role` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`user_id`, `team_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applications` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `environment` ENUM('development', 'staging', 'production') NOT NULL,
    `health_url` VARCHAR(500) NOT NULL,
    `team_id` VARCHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `last_modified_by` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `applications_name_key`(`name`),
    INDEX `applications_environment_idx`(`environment`),
    INDEX `applications_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_checks` (
    `id` VARCHAR(36) NOT NULL,
    `application_id` VARCHAR(36) NOT NULL,
    `status` ENUM('healthy', 'degraded', 'unhealthy') NOT NULL,
    `response_time_ms` INTEGER NULL,
    `details` JSON NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `health_checks_application_id_idx`(`application_id`),
    INDEX `health_checks_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `team_memberships` ADD CONSTRAINT `team_memberships_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_memberships` ADD CONSTRAINT `team_memberships_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_last_modified_by_fkey` FOREIGN KEY (`last_modified_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_checks` ADD CONSTRAINT `health_checks_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
