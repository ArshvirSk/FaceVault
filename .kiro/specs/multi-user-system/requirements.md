# Requirements Document

## Introduction

This document defines the requirements for implementing a multi-user system in FaceVault, a local AI face recognition photo organizer. The multi-user system will enable multiple users to collaborate on albums, where an album admin (creator) manages which users have access to their specific album. Each album has its own set of users, and users can be members of multiple albums.

FaceVault currently operates as a single-user application with a Python/FastAPI backend, Next.js/React frontend, and SQLite database. The multi-user system will add authentication, album-based permissions, and user management capabilities while maintaining the existing hierarchy of Albums → People → Photos.

## Glossary

- **User**: An individual account holder in FaceVault with unique credentials
- **User_Profile_Photo**: A photo of the user's face uploaded during registration, used for automatic face recognition
- **Album_Admin**: The user who created an album and has full management rights over it, including user management
- **Album_Member**: A user who has been granted access to an album by the Album_Admin
- **Album_Permission**: The access rights that determine which users can view and interact with a specific album
- **Person_Cluster**: A group of detected faces that the system has identified as belonging to the same person
- **Private_Person_Cluster**: A person cluster marked as private, visible only to the user whose face it represents
- **Public_Person_Cluster**: A person cluster visible to all members of the album
- **Privacy_Mode**: An album-level setting controlled by the Album_Admin that determines whether person clusters are private or public by default
- **Authentication_System**: The component responsible for verifying user credentials and managing sessions
- **User_Manager**: The component responsible for creating and managing user accounts
- **Permission_Layer**: The component that enforces album-based access control and person cluster privacy
- **Session**: An authenticated period during which a user is logged into the application
- **Login_Page**: The user interface where users enter credentials to authenticate
- **User_Switcher**: The user interface component that allows logging out and switching between users
- **Password_Hash**: A cryptographically hashed representation of a user's password stored in the database
- **Current_User**: The authenticated user making a request to the system
- **Album_User_Management_Interface**: The UI where Album_Admins can add or remove users from their albums
- **Album_Privacy_Settings**: The UI where Album_Admins can configure privacy mode for person clusters

## Requirements

### Requirement 1: User Account Management

**User Story:** As a new user, I want to create my own account with a profile photo, so that I can use FaceVault and have my face automatically recognized in albums.

#### Acceptance Criteria

1. THE User_Manager SHALL store user accounts with username, password_hash, and profile_photo_path in the database
2. WHEN a user creates an account, THE User_Manager SHALL validate that the username is unique
3. WHEN a user creates an account, THE User_Manager SHALL validate that the username is between 3 and 50 characters
4. WHEN a user creates an account, THE User_Manager SHALL validate that the password is at least 8 characters
5. WHEN a user creates an account, THE User_Manager SHALL hash the password before storing it
6. THE User_Manager SHALL use bcrypt or argon2 for password hashing
7. WHEN a user creates an account with an existing username, THE User_Manager SHALL return an error message indicating the username is taken
8. WHEN a user creates an account, THE User_Manager SHALL require a profile photo to be uploaded
9. WHEN a user uploads a profile photo, THE Application SHALL validate that it contains at least one detectable face
10. WHEN a user uploads a profile photo, THE Application SHALL extract face embeddings and store them associated with the user account

### Requirement 2: User Authentication

**User Story:** As a user, I want to log in with my username and password, so that I can access my photos securely.

#### Acceptance Criteria

1. WHEN a user submits valid credentials, THE Authentication_System SHALL create a session for that user
2. WHEN a user submits invalid credentials, THE Authentication_System SHALL return an error message without revealing whether the username or password was incorrect
3. THE Authentication_System SHALL verify passwords by comparing the hash of the submitted password with the stored password_hash
4. WHEN a user successfully authenticates, THE Authentication_System SHALL return a session token
5. THE Authentication_System SHALL maintain session state for authenticated users
6. WHEN a session expires or is invalid, THE Authentication_System SHALL require re-authentication

### Requirement 3: User Session Management

**User Story:** As a user, I want to stay logged in while using the application, so that I don't have to re-enter my credentials repeatedly.

#### Acceptance Criteria

1. WHEN a user authenticates successfully, THE Authentication_System SHALL create a session that persists across page refreshes
2. THE Authentication_System SHALL associate each session with a specific user
3. WHEN a user makes a request, THE Authentication_System SHALL identify the Current_User from the session
4. THE Authentication_System SHALL maintain sessions for at least 24 hours of inactivity
5. WHEN a user logs out, THE Authentication_System SHALL invalidate the session immediately

### Requirement 4: Login User Interface

**User Story:** As a user, I want a login page where I can enter my credentials, so that I can access my account.

#### Acceptance Criteria

1. WHEN the application starts without an authenticated session, THE Application SHALL display the Login_Page
2. THE Login_Page SHALL provide input fields for username and password
3. THE Login_Page SHALL mask password characters as they are typed
4. WHEN a user submits the login form, THE Login_Page SHALL send credentials to the Authentication_System
5. WHEN authentication fails, THE Login_Page SHALL display an error message
6. WHEN authentication succeeds, THE Login_Page SHALL redirect to the main application interface
7. THE Login_Page SHALL provide a link to create a new account

### Requirement 5: Account Creation User Interface

**User Story:** As a new user, I want a registration page where I can create my account and upload my profile photo, so that I can start using FaceVault.

#### Acceptance Criteria

1. THE Application SHALL provide an account creation interface accessible from the Login_Page
2. THE Account_Creation_Interface SHALL provide input fields for username, password, and password confirmation
3. THE Account_Creation_Interface SHALL provide a file upload field for the profile photo
4. THE Account_Creation_Interface SHALL display a preview of the uploaded profile photo
5. WHEN passwords do not match, THE Account_Creation_Interface SHALL display an error message
6. WHEN no profile photo is uploaded, THE Account_Creation_Interface SHALL display an error message
7. WHEN the uploaded photo does not contain a detectable face, THE Account_Creation_Interface SHALL display an error message
8. WHEN account creation fails validation, THE Account_Creation_Interface SHALL display specific error messages for each validation failure
9. WHEN account creation succeeds, THE Account_Creation_Interface SHALL automatically log the user in and redirect to the main application interface

### Requirement 6: User Logout and Switching

**User Story:** As a user, I want to log out of my account, so that another user can log in on the same device.

#### Acceptance Criteria

1. THE Application SHALL provide a logout option in the user interface
2. WHEN a user logs out, THE Authentication_System SHALL invalidate the current session
3. WHEN a user logs out, THE Application SHALL redirect to the Login_Page
4. WHEN a user logs out, THE Application SHALL clear any cached user data from the frontend

### Requirement 7: Album Ownership and Admin Rights

**User Story:** As a user who creates an album, I want to be the admin of that album, so that I can control who has access to it.

#### Acceptance Criteria

1. WHEN a user creates an album, THE Application SHALL automatically designate that user as the Album_Admin
2. THE Database SHALL store the admin_user_id for each album
3. WHEN a user scans a folder to create an album, THE Application SHALL set the Current_User as the Album_Admin
4. THE Album_Admin SHALL have full permissions to manage the album including adding/removing users
5. THE Album_Admin SHALL not be able to remove themselves as admin
6. WHEN an Album_Admin views their album, THE Application SHALL display admin controls

### Requirement 8: Album User Management by Admin

**User Story:** As an album admin, I want to add other users to my album, so that they can view and interact with the photos in that album.

#### Acceptance Criteria

1. THE Application SHALL provide an Album_User_Management_Interface accessible only to the Album_Admin
2. WHEN an Album_Admin adds a user to an album, THE Database SHALL create an album_members record
3. THE Album_User_Management_Interface SHALL display a list of all users in the system
4. THE Album_User_Management_Interface SHALL show which users are currently members of the album
5. WHEN an Album_Admin adds a user, THE Application SHALL grant that user immediate access to the album
6. THE Album_User_Management_Interface SHALL allow the Album_Admin to remove users from the album
7. WHEN an Album_Admin removes a user, THE Application SHALL revoke that user's access to the album immediately

### Requirement 9: Album Access Control

**User Story:** As a user, I want to see only the albums I have access to, so that I can view albums I created or albums I've been added to.

#### Acceptance Criteria

1. WHEN a user requests a list of albums, THE Permission_Layer SHALL return albums where the user is either the Album_Admin or an Album_Member
2. WHEN a user requests a specific album, THE Permission_Layer SHALL verify the user has access before returning it
3. WHEN a user attempts to access an album they don't have permission for, THE Permission_Layer SHALL return a 403 Forbidden error
4. THE Application SHALL display albums grouped by "My Albums" (admin) and "Shared With Me" (member)
5. WHEN a user views an album list, THE Application SHALL indicate which albums they admin vs which they are a member of

### Requirement 10: Shared People Within Albums

**User Story:** As an album member, I want to see the same identified people as other members of the album, so that we can collaborate on organizing photos.

#### Acceptance Criteria

1. THE Database SHALL associate each person with a specific album through an album_id foreign key
2. WHEN any user with access to an album identifies a person, THE Application SHALL make that person visible to all album members (subject to privacy settings)
3. WHEN a user requests people for an album, THE Permission_Layer SHALL verify the user has access to that album
4. WHEN a user merges or renames people in an album, THE changes SHALL be visible to all album members
5. THE Application SHALL allow any album member to identify, merge, or rename people within albums they have access to

### Requirement 10a: Album Privacy Mode for Person Clusters

**User Story:** As an album admin, I want to control whether person clusters in my album are private or public, so that I can protect user privacy when needed.

#### Acceptance Criteria

1. THE Database SHALL store a privacy_mode setting for each album (values: "public" or "private")
2. WHEN an album is created, THE Application SHALL default privacy_mode to "public"
3. THE Album_Admin SHALL be able to change the privacy_mode setting for their album
4. WHEN privacy_mode is "public", ALL person clusters in the album SHALL be visible to all album members
5. WHEN privacy_mode is "private", ONLY the person clusters belonging to the Current_User SHALL be visible to that user
6. THE Application SHALL provide an Album_Privacy_Settings interface accessible only to the Album_Admin
7. WHEN privacy_mode changes from "public" to "private", THE Application SHALL immediately apply privacy filtering to all person cluster queries

### Requirement 10b: Automatic User Face Recognition in Albums

**User Story:** As a user, I want my face to be automatically recognized in albums I join, so that I can quickly find photos of myself.

#### Acceptance Criteria

1. WHEN a user is added to an album, THE Application SHALL automatically search for faces matching the user's profile photo embeddings
2. WHEN matching faces are found, THE Application SHALL create or associate them with a person cluster linked to that user
3. THE Database SHALL store a user_id field in the persons table to link person clusters to specific users
4. WHEN a user views an album in private mode, THE Application SHALL show the person cluster associated with their user_id
5. WHEN a user views an album in public mode, THE Application SHALL show all person clusters regardless of user_id
6. THE Application SHALL run automatic face matching as a background process when users are added to albums

### Requirement 11: Shared Photos Within Albums

**User Story:** As an album member, I want to see all photos in albums I have access to, so that I can view and search through shared photo collections.

#### Acceptance Criteria

1. THE Database SHALL associate each photo with a specific album through an album_id foreign key
2. WHEN a user requests photos from an album, THE Permission_Layer SHALL verify the user has access to that album
3. WHEN the Album_Admin scans a folder, THE photos SHALL be accessible to all album members
4. WHEN a user views photos in an album, THE Application SHALL show all photos regardless of which user uploaded them
5. THE Application SHALL allow any album member to view photo metadata and perform searches within albums they have access to

### Requirement 12: Album-Scoped Face Recognition

**User Story:** As an album member, I want face recognition to work across all photos in the album, so that people are identified consistently for all members.

#### Acceptance Criteria

1. WHEN face detection processes photos in an album, THE Application SHALL make detected faces available to all album members
2. WHEN clustering executes for an album, THE Application SHALL process all faces in that album regardless of which user scanned them
3. WHEN a user performs face search in an album, THE Search_System SHALL search across all faces in that album
4. THE Application SHALL maintain separate FAISS indices per album
5. WHEN a user with album access performs clustering or search, THE results SHALL include all faces in the album

### Requirement 11: Database Schema Migration

**User Story:** As a system administrator, I want the database to be migrated to support multi-user with album-based permissions and privacy controls, so that existing data is preserved and the system can support collaborative albums.

#### Acceptance Criteria

1. THE Database SHALL include a users table with columns for user_id, username, password_hash, profile_photo_path, profile_face_embedding, and created_at
2. THE Database SHALL include an album_members table with columns for album_id, user_id, and added_at
3. THE Database SHALL add an admin_user_id foreign key column to the albums table
4. THE Database SHALL add a privacy_mode column to the albums table (default: "public")
5. THE Database SHALL add a user_id foreign key column to the persons table (nullable, links person clusters to users)
6. THE Database SHALL keep the album_id foreign key in the persons table
7. THE Database SHALL keep the album_id foreign key in the photos table (no user_id needed)
8. THE Database SHALL keep the album_id foreign key in the faces table (no user_id needed)
9. WHEN the database is migrated, THE Migration_System SHALL preserve all existing data
10. WHEN the database is migrated with existing data, THE Migration_System SHALL create a default admin user and assign all existing albums to that user

### Requirement 12: API Authentication Enforcement

**User Story:** As a user, I want all API endpoints to require authentication, so that my data cannot be accessed without logging in.

#### Acceptance Criteria

1. THE Backend SHALL require authentication for all API endpoints except login and account creation
2. WHEN an unauthenticated request is made to a protected endpoint, THE Backend SHALL return a 401 Unauthorized error
3. WHEN an authenticated request is made, THE Backend SHALL extract the Current_User from the session
4. THE Backend SHALL include the Current_User context in all database queries
5. THE Backend SHALL validate session tokens on every request to protected endpoints

### Requirement 13: Album Admin Permissions

**User Story:** As an album admin, I want exclusive rights to manage users, privacy settings, and delete the album, so that I maintain control over my photo collections.

#### Acceptance Criteria

1. ONLY the Album_Admin SHALL be able to access the Album_User_Management_Interface for their album
2. ONLY the Album_Admin SHALL be able to add users to their album
3. ONLY the Album_Admin SHALL be able to remove users from their album
4. ONLY the Album_Admin SHALL be able to delete their album
5. ONLY the Album_Admin SHALL be able to rename their album
6. ONLY the Album_Admin SHALL be able to change the privacy_mode setting for their album
7. WHEN a non-admin user attempts admin actions, THE Application SHALL return a 403 Forbidden error
8. THE Application SHALL display admin-only controls only to the Album_Admin

### Requirement 14: Album Member Permissions

**User Story:** As an album member, I want to view and interact with photos and people in albums I've been added to, respecting privacy settings.

#### Acceptance Criteria

1. Album_Members SHALL be able to view all photos in albums they have access to
2. WHEN an album is in public mode, Album_Members SHALL be able to view all identified people
3. WHEN an album is in private mode, Album_Members SHALL only be able to view their own person cluster
4. Album_Members SHALL be able to perform face searches within albums they have access to
5. WHEN an album is in public mode, Album_Members SHALL be able to identify, merge, and rename people
6. WHEN an album is in private mode, Album_Members SHALL only be able to interact with their own person cluster
7. Album_Members SHALL NOT be able to add or remove other users from the album
8. Album_Members SHALL NOT be able to delete the album
9. Album_Members SHALL NOT be able to change privacy settings
10. Album_Members SHALL be able to view album metadata including the admin's username and privacy mode

### Requirement 15: Password Security

#### Acceptance Criteria

1. THE User_Manager SHALL never store passwords in plain text
2. THE User_Manager SHALL use a cryptographically secure hashing algorithm with a salt
3. THE User_Manager SHALL use a work factor appropriate for the hashing algorithm to resist brute force attacks
4. WHEN a user changes their password, THE User_Manager SHALL hash the new password before storing it
5. THE Authentication_System SHALL use constant-time comparison when verifying password hashes to prevent timing attacks

### Requirement 15: Password Security

**User Story:** As a user, I want my password to be stored securely, so that it cannot be compromised if the database is accessed.

#### Acceptance Criteria

1. THE User_Manager SHALL never store passwords in plain text
2. THE User_Manager SHALL use a cryptographically secure hashing algorithm with a salt
3. THE User_Manager SHALL use a work factor appropriate for the hashing algorithm to resist brute force attacks
4. WHEN a user changes their password, THE User_Manager SHALL hash the new password before storing it
5. THE Authentication_System SHALL use constant-time comparison when verifying password hashes to prevent timing attacks

### Requirement 16: First-Time User Experience

**User Story:** As the first user of a new FaceVault installation, I want to easily create the initial account, so that I can start using the application immediately.

#### Acceptance Criteria

1. WHEN no users exist in the database, THE Application SHALL display the account creation interface
2. WHEN the first user account is created, THE Application SHALL automatically log that user in
3. THE Application SHALL provide clear instructions for creating the first account
4. WHEN the first account is created, THE Application SHALL function identically to subsequent accounts with no special privileges

### Requirement 16: First-Time User Experience

**User Story:** As the first user of a new FaceVault installation, I want to easily create the initial account, so that I can start using the application immediately.

#### Acceptance Criteria

1. WHEN no users exist in the database, THE Application SHALL display the account creation interface
2. WHEN the first user account is created, THE Application SHALL automatically log that user in
3. THE Application SHALL provide clear instructions for creating the first account
4. WHEN the first account is created, THE Application SHALL function identically to subsequent accounts with no special global privileges

### Requirement 17: User Interface Context Display

**User Story:** As a user, I want to see which account I'm logged in as and my role in each album, so that I know my permissions.

#### Acceptance Criteria

1. WHILE a user is authenticated, THE Application SHALL display the current username in the user interface
2. THE Application SHALL display the username in a consistent location across all pages
3. THE Application SHALL provide visual confirmation of the logged-in user's identity
4. WHEN a user views an album, THE Application SHALL indicate whether they are the admin or a member
5. WHEN a user views their profile or settings, THE Application SHALL display their username and account creation date

### Requirement 18: Concurrent User Support

**User Story:** As a user, I want the system to handle multiple users accessing the same album simultaneously, so that my collaborators and I can work together.

#### Acceptance Criteria

1. THE Authentication_System SHALL support multiple concurrent sessions for different users
2. THE Database SHALL handle concurrent read and write operations from multiple users on the same album
3. WHEN multiple users access the same album simultaneously, THE Permission_Layer SHALL maintain correct access control for each user
4. WHEN multiple users modify people or perform clustering in the same album, THE Application SHALL handle conflicts gracefully
5. THE Application SHALL not experience performance degradation with up to 10 concurrent users across multiple albums

### Requirement 19: Error Handling for Authentication and Permissions

**User Story:** As a user, I want clear error messages when authentication or permission checks fail, so that I can understand what went wrong.

#### Acceptance Criteria

1. WHEN authentication fails due to invalid credentials, THE Authentication_System SHALL return a generic error message
2. WHEN account creation fails due to validation errors, THE User_Manager SHALL return specific error messages for each validation failure
3. WHEN a session expires, THE Application SHALL redirect to the Login_Page with a message indicating the session expired
4. WHEN a user attempts to access an album without permission, THE Application SHALL display a clear "Access Denied" message
5. WHEN a user attempts an admin action without admin rights, THE Application SHALL display a message indicating admin privileges are required
6. THE Application SHALL not expose sensitive information in error messages that could aid unauthorized access

### Requirement 20: Data Integrity Constraints

**User Story:** As a user, I want the system to maintain data integrity, so that albums, photos, and people remain correctly associated.

#### Acceptance Criteria

1. THE Database SHALL enforce foreign key constraints between albums and admin_user_id
2. THE Database SHALL enforce foreign key constraints between album_members and both album_id and user_id
3. THE Database SHALL enforce foreign key constraints between persons and album_id
4. THE Database SHALL enforce foreign key constraints between photos and album_id
5. THE Database SHALL enforce foreign key constraints between faces and album_id
6. WHEN an album is deleted, THE Database SHALL cascade delete all associated photos, persons, faces, and album_members records
7. THE Database SHALL enforce uniqueness constraints on usernames
8. THE Database SHALL enforce uniqueness constraints on album_members (album_id, user_id) pairs to prevent duplicate memberships

### Requirement 21: User Discovery for Album Sharing

**User Story:** As an album admin, I want to see a list of all users in the system with their profile photos, so that I can add them to my albums.

#### Acceptance Criteria

1. THE Application SHALL provide an endpoint to list all users in the system
2. THE Album_User_Management_Interface SHALL display all users with their usernames and profile photos
3. THE Album_User_Management_Interface SHALL indicate which users are already members of the album
4. THE Album_User_Management_Interface SHALL allow filtering or searching users by username
5. THE Application SHALL not expose sensitive user information (like password hashes) in the user list

### Requirement 22: User Profile Photo Management

**User Story:** As a user, I want to update my profile photo, so that my face recognition remains accurate if my appearance changes.

#### Acceptance Criteria

1. THE Application SHALL provide a user profile interface where users can view their current profile photo
2. THE Application SHALL allow users to upload a new profile photo to replace the existing one
3. WHEN a user updates their profile photo, THE Application SHALL validate that it contains at least one detectable face
4. WHEN a user updates their profile photo, THE Application SHALL extract new face embeddings and update the stored embeddings
5. WHEN a user updates their profile photo, THE Application SHALL optionally re-run face matching across albums they are members of
6. THE Application SHALL preserve the old profile photo path until the new one is successfully processed

### Requirement 23: Privacy Mode User Experience

**User Story:** As a user in a private mode album, I want to easily find and view photos of myself, so that I can quickly access my personal photos.

#### Acceptance Criteria

1. WHEN a user views an album in private mode, THE Application SHALL display a clear indicator that privacy mode is enabled
2. WHEN a user views an album in private mode, THE Application SHALL show only their person cluster in the people list
3. WHEN a user clicks on their person cluster in private mode, THE Application SHALL show all photos containing their face
4. WHEN a user performs a search in private mode, THE Application SHALL filter results to only show photos containing their face
5. THE Application SHALL display a message explaining privacy mode if no person cluster exists for the user yet

