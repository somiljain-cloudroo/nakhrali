-- Create sample user profiles (contacts) for testing
-- Note: These will need actual auth.users entries to work with authentication
-- For now, we'll use placeholder UUIDs that you'll need to replace with real user IDs after signup

-- Insert sample contact profiles
INSERT INTO public.profiles (id, email, full_name, company_name, phone, address, city, state, postal_code, country, role, contact_type, job_title, department) VALUES
-- Primary contact for ABC Corporation
('11111111-1111-1111-1111-111111111111', 'john.smith@abccorp.com.au', 'John Smith', 'ABC Corporation', '+61 3 1234 5678', '123 Business Ave', 'Melbourne', 'VIC', '3000', 'Australia', 'customer', 'primary', 'Purchasing Manager', 'Procurement'),

-- Secondary contact for ABC Corporation  
('22222222-2222-2222-2222-222222222222', 'mary.jones@abccorp.com.au', 'Mary Jones', 'ABC Corporation', '+61 3 1234 5679', '123 Business Ave', 'Melbourne', 'VIC', '3000', 'Australia', 'customer', 'ordering', 'Assistant Buyer', 'Procurement'),

-- Primary contact for XYZ Retail Group
('33333333-3333-3333-3333-333333333333', 'david.wilson@xyzretail.com.au', 'David Wilson', 'XYZ Retail Group', '+61 2 9876 5432', '456 Commerce St', 'Sydney', 'NSW', '2000', 'Australia', 'customer', 'primary', 'Operations Manager', 'Operations'),

-- Multi-account contact (works for both XYZ and Government)
('44444444-4444-4444-4444-444444444444', 'sarah.brown@consultant.com.au', 'Sarah Brown', 'Independent Consultant', '+61 2 5555 5555', '789 Consultant Way', 'Canberra', 'ACT', '2600', 'Australia', 'customer', 'ordering', 'Procurement Specialist', 'Consulting'),

-- Government contact
('55555555-5555-5555-5555-555555555555', 'admin@gov.au', 'Government Admin', 'Government Services Dept', '+61 2 6123 4567', '789 Official Blvd', 'Canberra', 'ACT', '2600', 'Australia', 'customer', 'primary', 'Procurement Officer', 'Administration');

-- Create contact-account relationships
INSERT INTO public.contact_account_relationships (contact_id, account_id, relationship_type, can_place_orders, can_view_orders, can_manage_account, is_primary_contact) VALUES
-- John Smith - Primary owner of ABC Corporation
('11111111-1111-1111-1111-111111111111', (SELECT id FROM public.accounts WHERE account_number = 'ACC-2025-0001'), 'owner', true, true, true, true),

-- Mary Jones - Regular member of ABC Corporation (can order but not manage)
('22222222-2222-2222-2222-222222222222', (SELECT id FROM public.accounts WHERE account_number = 'ACC-2025-0001'), 'member', true, true, false, false),

-- David Wilson - Primary owner of XYZ Retail Group
('33333333-3333-3333-3333-333333333333', (SELECT id FROM public.accounts WHERE account_number = 'ACC-2025-0002'), 'owner', true, true, true, true),

-- Sarah Brown - Multi-account consultant (admin for XYZ, member for Government)
('44444444-4444-4444-4444-444444444444', (SELECT id FROM public.accounts WHERE account_number = 'ACC-2025-0002'), 'admin', true, true, true, false),
('44444444-4444-4444-4444-444444444444', (SELECT id FROM public.accounts WHERE account_number = 'ACC-2025-0003'), 'member', true, true, false, false),

-- Government Admin - Primary owner of Government Services
('55555555-5555-5555-5555-555555555555', (SELECT id FROM public.accounts WHERE account_number = 'ACC-2025-0003'), 'owner', true, true, true, true);

-- Make customer_id nullable to support both individual and account-based orders
ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;

-- Create some sample orders to demonstrate different scenarios
-- Individual order from a contact
INSERT INTO public.orders (order_number, customer_id, subtotal, tax_amount, total_amount, notes, status) VALUES
(public.generate_order_number(), '11111111-1111-1111-1111-111111111111', 150.00, 15.00, 165.00, 'Personal order from John Smith', 'approved');

-- Account-based order from ABC Corporation
INSERT INTO public.orders (order_number, account_id, ordered_by_contact_id, subtotal, tax_amount, total_amount, notes, status) VALUES
(public.generate_order_number(), (SELECT id FROM public.accounts WHERE account_number = 'ACC-2025-0001'), '22222222-2222-2222-2222-222222222222', 500.00, 50.00, 550.00, 'Monthly office supplies order for ABC Corp placed by Mary Jones', 'pending');