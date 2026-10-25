-- Run after supabase/public-intros.sql. No data mutations.
do $test$
begin
  assert private.oeldk_public_article_intro('<script><div class="tc_richcontent"><p>Wrong story</p></div></script><div class="tc_richcontent"><p>Public opening.</p></div><p>Related story</p>','TV2.dk') = 'Public opening.';
  assert private.oeldk_public_article_intro('<p class="hydra-article-body-paragraph">Klokken 11.06: Artiklen er opdateret.</p><p class="hydra-article-body-paragraph">Public opening.</p>','DR') = 'Public opening.';
  assert private.oeldk_public_article_intro('<div class="block--entity-tryout-hidden-body"><p>Hidden subscription text.</p></div>','Version2') is null;
  assert private.oeldk_public_article_intro('<div class="mu-body"><p>Public opening.</p><div class="ad"><p>Advertisement.</p></div></div>','Version2') = 'Public opening.';
  assert private.oeldk_public_article_intro('<p>Unrelated navigation.</p>','Politiken') is null;
  assert private.oeldk_public_article_intro('<p class="drop-cap">Public opening.</p><p>Second paragraph.</p></div><p>Subscription.</p>','Politiken') = 'Public opening. Second paragraph.';
  assert private.oeldk_berlingske_free_intro('<script id="__NEXT_DATA__">{"props":{"pageProps":{"article":{"payWall":"Default","loginWall":null,"body":[{"type":"ParagraphNode","children":[{"type":"TextNode","value":"Paid text."}]}]}}}}</script>') is null;
  assert private.oeldk_berlingske_free_intro('<script id="__NEXT_DATA__">{"props":{"pageProps":{"article":{"payWall":null,"loginWall":null,"body":[{"type":"ParagraphNode","children":[{"type":"TextNode","value":"Public text."}]}]}}}}</script>') = 'Public text.';
end $test$;
