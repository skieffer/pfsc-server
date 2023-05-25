# --------------------------------------------------------------------------- #
#   Copyright (c) 2011-2023 Proofscape contributors                           #
#                                                                             #
#   Licensed under the Apache License, Version 2.0 (the "License");           #
#   you may not use this file except in compliance with the License.          #
#   You may obtain a copy of the License at                                   #
#                                                                             #
#       http://www.apache.org/licenses/LICENSE-2.0                            #
#                                                                             #
#   Unless required by applicable law or agreed to in writing, software       #
#   distributed under the License is distributed on an "AS IS" BASIS,         #
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  #
#   See the License for the specific language governing permissions and       #
#   limitations under the License.                                            #
# --------------------------------------------------------------------------- #

"""Tests of sphinx builds. """

import json
import pathlib

from bs4 import BeautifulSoup
from flask import Flask

from pfsc.build.repo import get_repo_info
from pfsc.build.manifest import load_manifest


def get_chart_widget_anchors(soup):
    """
    Get the list of any and all <a> tags having class `chartWidget`.
    """
    return list(soup.find_all('a', class_='chartWidget'))


def get_page_data_from_script_tag(soup):
    """
    If the HTML contains a <script id=""pfsc-page-data"> tag, then parse
    the JSON and return the data itself.

    Otherwise return None.
    """
    script = soup.find('script', id='pfsc-page-data')
    if script:
        text = script.text.strip()
        intro = 'const pfsc_page_data = '
        if text.startswith(intro):
            rem = text[len(intro):]
            data = json.loads(rem)
            return data
    return None


def get_highlights(soup, language):
    """
    Grab all the highlight divs, for a given language.
    """
    return list(soup.find_all('div', class_=f'highlight-{language}'))


expected_widget_data_spx_doc1 = json.loads("""
{
    "libpath": "test.spx.doc1._sphinx.index",
    "version": "v0.1.0",
    "widgets": {
        "test-spx-doc1-_sphinx-index-w0_v0.1.0": {
            "view": [
                "test.moo.bar.results.Pf"
            ],
            "versions": {
                "test.moo.bar": "v0.3.4"
            },
            "pane_group": "test.spx.doc1@v0.1.0._sphinx.index:CHART:",
            "src_line": 13,
            "type": "CHART",
            "uid": "test-spx-doc1-_sphinx-index-w0_v0.1.0",
            "version": "v0.1.0",
            "widget_libpath": "test.spx.doc1._sphinx.index.w0"
        }
    },
    "docInfo": null
}
""")


def test_generated_pfsc_widget_data_script_tag(app):
    """
    Test that we get the expected widget data script tag.
    """
    # PyCharm seems to be confused, and thinks `app` is a `SphinxTestApp`.
    # So we give it an assertion to convince it that this is our Flask app
    # test fixture.
    assert isinstance(app, Flask)
    with app.app_context():
        libpath = 'test.spx.doc1'
        version = 'v0.1.0'
        ri = get_repo_info(libpath)
        build_dir = ri.get_sphinx_build_dir(version)
        with open(pathlib.Path(build_dir) / 'index.html') as f:
            html = f.read()
        soup = BeautifulSoup(html, 'html.parser')
        widget_data = get_page_data_from_script_tag(soup)
        #print(json.dumps(widget_data, indent=4))
        assert widget_data == expected_widget_data_spx_doc1


def test_manifest(app):
    """
    Test that we get the expected structure in the build manifest,
    and in the relational model.
    """
    with app.app_context():
        libpath = 'test.spx.doc1'
        version = 'v0.1.0'
        manifest = load_manifest(libpath, version=version)
        assert manifest.has_sphinx_doc is True

        root = manifest.get_root_node()
        s = root.children[0]
        assert s.id == f'{libpath}._sphinx.index'
        assert s.data['type'] == "SPHINX"
        assert s.data['name'] == "Sphinx"

        model = []
        root.build_relational_model(model)
        # Should have exactly one node of type "SPHINX", and it should be the
        # second model element, as the first child of the root node.
        sphinx_indices = [i for i, item in enumerate(model) if item['type'] == "SPHINX"]
        assert sphinx_indices == [1]


def test_spx_doc0(app):
    """
    Cf `test_sphinx_build()` in the `sphinx-proofscape` project.
    This test now takes over testing on Pages A and C, while Page B is still
    tested there.
    """
    with app.app_context():
        libpath = 'test.spx.doc0'
        version = 'v0.1.0'
        ri = get_repo_info(libpath)
        build_dir = pathlib.Path(ri.get_sphinx_build_dir(version))

        # Page A
        # ======
        html = (build_dir / 'pageA.html').read_text()
        soup = BeautifulSoup(html, 'html.parser')
    
        # Have exactly one chart widget anchor tag, and it has a class encoding its UID.
        A = get_chart_widget_anchors(soup)
        assert len(A) == 1
        assert 'test-spx-doc0-_sphinx-pageA-w0_v0.1.0' in A[0].get('class')
    
        # Defines the expected pfsc_page_data
        page_data = get_page_data_from_script_tag(soup)
        # print('\n', json.dumps(page_data, indent=4))
        widgets = page_data['widgets']
        assert len(widgets) == 1
        assert widgets["test-spx-doc0-_sphinx-pageA-w0_v0.1.0"] == {
            "view": [
                "test.hist.lit.H.ilbert.ZB.Thm168.Pf"
            ],
            "versions": {
                "test.hist.lit": "v0.0.0"
            },
            "pane_group": "test.spx.doc0@v0.1.0._sphinx.pageA:CHART:",
            "src_line": 10,
            "type": "CHART",
            "uid": "test-spx-doc0-_sphinx-pageA-w0_v0.1.0",
            "version": "v0.1.0",
            "widget_libpath": "test.spx.doc0._sphinx.pageA.w0"
        }

        # Page B
        # ======
        # We don't check much: just confirm that syntax highlighting is indeed
        # happening (which proves we're using the external sphinx-proofscape
        # pkg for this, since we don't define lexers locally).
        html = (build_dir / 'pageB.html').read_text()
        soup = BeautifulSoup(html, 'html.parser')
        hl = get_highlights(soup, 'proofscape')
        assert len(hl) == 1
        
        # Page C
        # ======
        html = (build_dir / 'foo/pageC.html').read_text()
        soup = BeautifulSoup(html, 'html.parser')
    
        # Get the expected anchor tags:
        A = get_chart_widget_anchors(soup)
        for i, (a, expected_label) in enumerate(zip(A, PAGE_C_WIDGETS_LABELS)):
            assert f'test-spx-doc0-_sphinx-foo-pageC-w{i}_v0.1.0' in a.get('class')
            assert a.text == expected_label
    
        # Get the expected pfsc_page_data:
        page_data = get_page_data_from_script_tag(soup)
        #print('\n', json.dumps(page_data, indent=4))
        assert page_data == PAGE_C_PAGE_DATA


PAGE_C_WIDGETS_LABELS = [
    'chart widget',
    'chart widgets',
    'substitutions',
    'one-line color definition',
    'color defn with repeated LHS, plus use of update',
]


PAGE_C_PAGE_DATA = {
    "libpath": "test.spx.doc0._sphinx.foo.pageC",
    "version": "v0.1.0",
    "widgets": {
        "test-spx-doc0-_sphinx-foo-pageC-w0_v0.1.0": {
            "view": [
                "test.hist.lit.H.ilbert.ZB.Thm168.Pf"
            ],
            "versions": {
                "test.hist.lit": "v0.0.0"
            },
            "pane_group": "test.spx.doc0@v0.1.0._sphinx.foo.pageC:CHART:",
            "src_line": 12,
            "type": "CHART",
            "uid": "test-spx-doc0-_sphinx-foo-pageC-w0_v0.1.0",
            "version": "v0.1.0",
            "widget_libpath": "test.spx.doc0._sphinx.foo.pageC.w0"
        },
        "test-spx-doc0-_sphinx-foo-pageC-w1_v0.1.0": {
            "view": [
                "test.hist.lit.H.ilbert.ZB.Thm168.Thm"
            ],
            "versions": {
                "test.hist.lit": "v0.0.0"
            },
            "pane_group": "test.spx.doc0@v0.1.0._sphinx.foo.pageC:CHART:",
            "src_line": 14,
            "type": "CHART",
            "uid": "test-spx-doc0-_sphinx-foo-pageC-w1_v0.1.0",
            "version": "v0.1.0",
            "widget_libpath": "test.spx.doc0._sphinx.foo.pageC.w1"
        },
        "test-spx-doc0-_sphinx-foo-pageC-w2_v0.1.0": {
            "on_board": [
                "gh.foo.spam.H.ilbert.ZB.Thm168.X1"
            ],
            "off_board": [
                "gh.foo.spam.H.ilbert.ZB.Thm168.X2"
            ],
            "view": [
                "test.hist.lit.H.ilbert.ZB.Thm168.Thm.A10",
                "test.hist.lit.H.ilbert.ZB.Thm168.Pf.A10",
                "test.hist.lit.H.ilbert.ZB.Thm168.Pf.A20"
            ],
            "color": {
                ":olB": [
                    "test.hist.lit.H.ilbert.ZB.Thm168.Pf.A10",
                    "test.hist.lit.H.ilbert.ZB.Thm168.Pf.A20"
                ],
                ":bgG": [
                    "test.hist.lit.H.ilbert.ZB.Thm168.Thm.A10"
                ]
            },
            "versions": {
                "gh.foo.spam": "WIP",
                "test.hist.lit": "v0.0.0"
            },
            "pane_group": "test.spx.doc0@v0.1.0._sphinx.foo.pageC:CHART:",
            "src_line": 28,
            "type": "CHART",
            "uid": "test-spx-doc0-_sphinx-foo-pageC-w2_v0.1.0",
            "version": "v0.1.0",
            "widget_libpath": "test.spx.doc0._sphinx.foo.pageC.w2"
        },
        "test-spx-doc0-_sphinx-foo-pageC-w3_v0.1.0": {
            "view": [
                "test.hist.lit.H.ilbert.ZB.Thm168.Pf"
            ],
            "color": {
                ":olB": [
                    "test.hist.lit.H.ilbert.ZB.Thm168.Pf.A10",
                    "test.hist.lit.H.ilbert.ZB.Thm168.Pf.A20"
                ]
            },
            "versions": {
                "test.hist.lit": "v0.0.0"
            },
            "pane_group": "test.spx.doc0@v0.1.0._sphinx.foo.pageC:CHART:",
            "src_line": 36,
            "type": "CHART",
            "uid": "test-spx-doc0-_sphinx-foo-pageC-w3_v0.1.0",
            "version": "v0.1.0",
            "widget_libpath": "test.spx.doc0._sphinx.foo.pageC.w3"
        },
        "test-spx-doc0-_sphinx-foo-pageC-w4_v0.1.0": {
            "color": {
                ":bgG": [
                    "test.hist.lit.H.ilbert.ZB.Thm168.Pf.A10",
                    "test.hist.lit.H.ilbert.ZB.Thm168.Pf.A20",
                    "test.hist.lit.H.ilbert.ZB.Thm168.Thm.A10"
                ],
                ":update": True
            },
            "versions": {
                "test.hist.lit": "v0.0.0"
            },
            "pane_group": "test.spx.doc0@v0.1.0._sphinx.foo.pageC:CHART:",
            "src_line": 40,
            "type": "CHART",
            "uid": "test-spx-doc0-_sphinx-foo-pageC-w4_v0.1.0",
            "version": "v0.1.0",
            "widget_libpath": "test.spx.doc0._sphinx.foo.pageC.w4"
        }
    },
    "docInfo": None
}
