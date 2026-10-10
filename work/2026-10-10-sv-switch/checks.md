# Checks: the Street View / Photo switch never disappears

| requirement | verdict | evidence |
| --- | --- | --- |
| baseline `npm run verify` | pass | 251 pass (commit e90b6c7) |
| Shown on every photo and Street View round from the first second | pass | sv8.mjs: present at t0 in every case (photo place, no panorama, no key, Street View-only place) |
| Starts on Photo, and every new place starts on Photo again | pass | sv8.mjs: "Photo[on]" at t0; after choosing Street View, the next place opens on Photo |
| Street View side greyed with a reason until a panorama exists | pass | "Looking for Street View…", "No Street View near this place", "Street View is off (see Settings, Picture)"; a forced click changes nothing |
| A place with no photo: Photo is the starting view, frozen; Street View restores where you walked | pass | sv8.mjs street: Photo → movement off, at START; Street View → movement on; Photo again → START; Street View again → back at WALKED |
| No overlap with the header, map or reveal card | pass | svl.mjs at 360, 390, 667×375, 740×360, 844×390, 768×1024, 1280: clear of map and header, on top; desktop reveal moves it top-left |
| Reveal on phones and landscape phones | pass | hidden while the result card and map cover the whole scene |
| Fixed on the way: in landscape the switch sat over the map; on a 768 px tablet in a duel it covered the score card | pass | now left of the map in landscape, and below the measured header height on wider screens |
