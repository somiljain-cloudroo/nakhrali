-- Create multi-account relationships for John Smith (the current logged-in user)
-- John Smith will have different roles across multiple accounts
-- Skipped if the profile does not exist (e.g. local dev without the production user)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = '05c7dfac-546e-414b-9f0d-34357da3a939') THEN
    INSERT INTO public.contact_account_relationships (contact_id, account_id, relationship_type, can_place_orders, can_view_orders, can_manage_account, is_primary_contact) VALUES
    ('05c7dfac-546e-414b-9f0d-34357da3a939', '4525d5ae-c2c6-4a6a-9ffc-711c8c2c99fa', 'owner', true, true, true, true),
    ('05c7dfac-546e-414b-9f0d-34357da3a939', '96241fae-1dea-4fc3-b615-9f8ceaa044dd', 'admin', true, true, true, false),
    ('05c7dfac-546e-414b-9f0d-34357da3a939', 'b50d5e6b-b87a-46cf-a7b8-7d9caf58ee4a', 'member', true, true, false, false)
    ON CONFLICT (contact_id, account_id) DO UPDATE SET
      relationship_type = EXCLUDED.relationship_type,
      can_place_orders = EXCLUDED.can_place_orders,
      can_view_orders = EXCLUDED.can_view_orders,
      can_manage_account = EXCLUDED.can_manage_account,
      is_primary_contact = EXCLUDED.is_primary_contact;
  END IF;
END $$;