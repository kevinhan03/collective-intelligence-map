update public.theme_maps
set title = case slug
  when 'korea-vintage' then 'Korea Vintage Shop'
  when 'tokyo-fashion' then 'Tokyo Fashion Store'
  else title
end
where slug in ('korea-vintage', 'tokyo-fashion');
