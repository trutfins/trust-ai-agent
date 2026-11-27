from PIL import Image, ImageDraw, ImageFont
W='/tmp/claude-0/work/'
def F(w,s): return ImageFont.truetype(W+f'plex-ar-{w}.ttf', s, layout_engine=ImageFont.Layout.RAQM)
def rtext(d, xr, ytop, txt, font, fill):
    l,t,r,b = d.textbbox((0,0), txt, font=font, direction='rtl', language='ar')
    d.text((xr-(r-l)-l, ytop-t), txt, font=font, fill=fill, direction='rtl', language='ar')
    return r-l
def edit(src, dst, title_lines, header, user, box, sizes):
    im=Image.open(src).convert('RGB'); px=im.load(); d=ImageDraw.Draw(im)
    hs, us, ds = sizes
    # header block
    (y0,y1,x0,x1)=header; bg=px[x1+3,y0-3]
    d.rectangle((x0-3,y0-3,x1+2,y1+2), fill=bg)
    y=y0
    for ln in title_lines:
        rtext(d, x1, y, ln, F(700,hs), (238,242,246)); y += int(hs*1.45)
    # user line
    (y0,y1,x0,x1)=user; d.rectangle((x0-3,y0-2,x1+2,y1+2), fill=bg)
    rtext(d, x1, y0-1, 'المدير المالي', F(400,us), (150,166,186))
    # dropdown text
    (y0,y1,x0,x1)=box; inner=px[x1-2,y0+4]
    d.rectangle((x0+12, y0+3, x1-3, y1-3), fill=inner)
    t=' '.join(title_lines)
    f=F(400,ds); l,tp,r,b=d.textbbox((0,0),t,font=f,direction='rtl',language='ar')
    rtext(d, x1-6, y0+(y1-y0-(b-tp))//2, t, f, (222,230,238))
    if dst.endswith('.webp'): im.save(dst,'WEBP',quality=88,method=6)
    else: im.save(dst)
    return im
O=W+'out/assets/img/portfolio/'
jobs=[
 ('c3-d',['مصنع صناعات عامة'],(223,248,827,952),(257,265,840,952),(291,309,812,953),(11,9,8)),
 ('c4-d',['مكتب خدمات','محاسبية ومالية'],(214,240,829,955),(248,255,843,955),(281,299,815,955),(11,9,8)),
 ('c3-m',['مصنع صناعات عامة'],(515,533,604,696),(540,545,614,696),(567,579,592,696),(8,6,6)),
 ('c4-m',['مكتب خدمات','محاسبية ومالية'],(508,527,604,696),(533,538,615,696),(557,572,593,697),(8,6,6)),
]
for name,lines,h,u,bx,sz in jobs:
    n=name[1]; k=name[-1]
    edit(W+f'img/{name}.webp', O+f'pf-{n}-{k}.webp', lines,h,u,bx,sz)
    edit(W+f'img/{name}.webp', W+f'chk-{name}.png', lines,h,u,bx,sz)
print('done')
