REVOKE ALL ON FUNCTION public.assert_home_featured_limit() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "product images admin read" ON storage.objects;
DROP POLICY IF EXISTS "product images admin insert" ON storage.objects;
DROP POLICY IF EXISTS "product images admin update" ON storage.objects;
DROP POLICY IF EXISTS "product images admin delete" ON storage.objects;

CREATE POLICY "product images admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "product images admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "product images admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "product images admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());