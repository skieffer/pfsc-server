/* ------------------------------------------------------------------------- *
 *  Copyright (c) 2011-2023 Proofscape Contributors                          *
 *                                                                           *
 *  Licensed under the Apache License, Version 2.0 (the "License");          *
 *  you may not use this file except in compliance with the License.         *
 *  You may obtain a copy of the License at                                  *
 *                                                                           *
 *      http://www.apache.org/licenses/LICENSE-2.0                           *
 *                                                                           *
 *  Unless required by applicable law or agreed to in writing, software      *
 *  distributed under the License is distributed on an "AS IS" BASIS,        *
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. *
 *  See the License for the specific language governing permissions and      *
 *  limitations under the License.                                           *
 * ------------------------------------------------------------------------- */

import { TreeManager } from "./TreeManager";
import { dragulaWithContentPanelOverlays } from "../content_types/dnd";

const ise = {};
const dojo = {};

define([
    "dojo/query",
    "dojo/dom-construct",
    "dijit/MenuSeparator",
    "dijit/MenuItem",
    "dijit/PopupMenuItem",
    "dijit/layout/ContentPane",
    "ise/util",
    "dojo/NodeList-traverse",
    "dojo/NodeList-manipulate",
], function(
    query,
    domConstruct,
    MenuSeparator,
    MenuItem,
    PopupMenuItem,
    ContentPane,
    iseUtil,
) {
    dojo.query = query;
    dojo.domConstruct = domConstruct;
    dojo.MenuSeparator = MenuSeparator;
    dojo.MenuItem = MenuItem;
    dojo.PopupMenuItem = PopupMenuItem;
    dojo.ContentPane = ContentPane;
    ise.util = iseUtil;
});

// We make use of these in managing drag-and-drop:
const treeIconClass = 'dijitTreeIcon';
const deducIconClass = 'deducIcon16';
const libpathClassPrefix = 'pfscLibpathV';


export class BuildTreeManager extends TreeManager {

    constructor(treeDiv) {
        super(treeDiv, {});
        this.drake = this.setUpDragAndDrop();
        this.contextMenu = this.setUpContextMenu(this.treeDiv, this.rebuildContextMenu.bind(this));
    }

    setUpDragAndDrop() {
        return dragulaWithContentPanelOverlays({
            copy: true,
            isContainer: el => {
                const isTreeContainer = el.classList.contains('dijitTreeContainer');
                const isNodeContainer = el.classList.contains('dijitTreeNodeContainer');
                const isMooseGraphArea = el.classList.contains('mooseGraphArea');
                return isTreeContainer || isNodeContainer || isMooseGraphArea;
            },
            accepts: (el, target, source, sibling) => (
                // The container is a Moose graph area...
                target.classList.contains('mooseGraphArea')
                // ...AND, the tree node is of DEDUC type:
                // (see https://developer.mozilla.org/en-US/docs/Web/CSS/:scope)
                && el.querySelector(`:scope > .dijitTreeRow > .dijitTreeContent > .${deducIconClass}`)
            ),
            moves: (el, source, handle, sibling) => {
                // The user has to click either on a tree icon, or on the text label beside it.
                const handleIsTreeIcon = handle.classList.contains(treeIconClass);
                let handleIsTreeLabel = null;
                // Only if a tree icon was not clicked do we bother checking whether a label was clicked.
                if (!handleIsTreeIcon) {
                    handleIsTreeLabel = dojo.query(handle).siblings('.'+treeIconClass).length;
                }
                return handleIsTreeIcon || handleIsTreeLabel;
            }
        }, {
            socketSelector: '.cpSocket.pdfSocket', // We only want panel overlays on PDF panels.
            onDrop: (drake, el, target, source, sibling, paneId) => {
                // We get `target === null` if you drop a tree node over the tree, where you picked it up.
                if (target === null) return;

                // Extract the libpath and version of the item that was dropped.
                const iconElt = dojo.query(el).query('.'+treeIconClass)[0];
                const iconClasses = iconElt.classList;
                let libpath;
                let version;
                for (const cl of iconClasses.values()) {
                    if (cl.startsWith(libpathClassPrefix)) {
                        const p = cl.split('--');
                        libpath = p[1].replaceAll('-', '.');
                        version = p[2];
                    }
                }

                if (paneId) {
                    // Any type of tree item was dropped onto a PDF panel.
                    // Show a linking dialog.
                    this.hub.contentManager.showLinkingDialog(paneId, {
                        targetTreeItem: {libpath, version},
                    });
                } else {
                    // A deduc tree item was dropped on a Moose graph area.
                    // Get the ContentPane in which the moose graph area lives, and open the deduc there.
                    const pane = dojo.query(target).parent()[0];
                    this.hub.chartManager.openDeducInExistingPane(libpath, version, pane);
                }

                // Destroy the copy.
                dojo.domConstruct.destroy(el);
            },
        });
    }

    activate() {
    }

    repoIsOpen(repopathv) {
        return this.treeDivs.has(repopathv);
    }

    /* Produce the specially-formatted class string we add to a tree node's icon element,
     * in order to indicate the libpath and version of the Proofscape entity represented
     * by this tree node.
     */
    makeTreeIconLibpathClass(libpath, version) {
        return `${libpathClassPrefix}--${libpath.replaceAll('.', '-')}--${version}`;
    }

    /* Given the data describing a repo tree model, load and display this repo tree.
     *
     * @param repopath: the libpath of the repo whose tree is given
     * @param version: the version of the repo whose tree is given
     * @param model: an array, giving the repo tree as a relational model of the kind returned
     *   by `ManifestTreeNode.build_relational_model` in `build.py` at the back-end.
     */
    loadTree({repopath, version, model}) {
        const repopathv = ise.util.lv(repopath, version);
        if (this.repoIsOpen(repopathv)) return;
        const hub = this.hub;
        const mgr = this;
        super.loadTree({
            treeUid: repopathv,
            model: model,
            modifyData: theStore => {
                // Rename root item, so that it displays the version.
                theStore.query({id: repopath})[0].name = repopathv;
            },
            initialQuery: {id: repopath},
            mayHaveChildren: function(item) {
                return (item.type === "MODULE" || item.type === "SPHINX") && item.hasChildren;
            },
            getIconClass: function(/*dojo.store.Item*/ item, /*Boolean*/ opened){
                const classes = [
                    'menuIcon',
                    mgr.makeTreeIconLibpathClass(item.libpath, version),
                ];
                if (item.type === "MODULE") {
                    classes.push('ringIcon');
                    if (item.hasSubmodules && !item.hasContents) {
                        // Non-terminal module without contents.
                        classes.push('noContentsModuleIcon')
                    }
                } else if (item.type === hub.contentManager.crType.SPHINX) {
                    classes.push('sphinxIcon16');
                } else {
                    classes.push('contentIcon');
                    if (item.type === hub.contentManager.crType.NOTES) {
                        classes.push('notesIcon16');
                    }
                    else if (item.type === hub.contentManager.crType.CHART) {
                        classes.push(`iconDepth${item.depth}`);
                        classes.push('deducIcon16');
                    }
                }
                return classes.join(' ');
            },
            activateTreeItem: (item, event) => {mgr.activateTreeItem(item, version, event)},
            homeId: "repotree_" + repopathv.replaceAll('.', '-').replaceAll("@", "_"),
            treeDiv: this.treeDiv,
        });
        this.dispatch({
            type: 'treeLoaded',
            repopathv: repopathv,
        });
    }

    activateTreeItem(item, version, event) {
        // Do we want to load the content, or edit the source?
        // For now the rule is: holding Alt (Opt on Mac) means you want to open the source.
        let source = event.altKey;
        this.openItem({item, version, source});
    }

    /* Open a tree item.
     *
     * param item: the item to be opened. We'll make a deep copy of it; you don't have to.
     * param version: the version at which the item is to be opened.
     * param source: boolean: true if you want to edit the source code for this item,
     *               rather than opening/viewing its content.
     */
    openItem({item, version, source}) {
        if (item.type === "MODULE" && item.hasSubmodules && !item.hasContents) {
            // This case arises for non-terminal modules having no `__.pfsc` file.
            // For these, there is nothing to open.
            return;
        }

        const itemCopy = JSON.parse(JSON.stringify(item));
        // Given `item` might already contain `version`, in which case `version`
        // arg to this method need not be given. But if it is given, it overrides.
        if (version) {
            itemCopy.version = version;
        }
        if (source || item.type === "MODULE") {
            this.hub.contentManager.markInfoForLoadingSource(itemCopy);
            if (itemCopy.is_rst === undefined) {
                itemCopy.is_rst = this.itemIsRst(item);
            }
        }
        this.hub.contentManager.openContentInActiveTC(itemCopy);
    }

    /* Determine whether a tree item represents an rst module, or an object
     * defined in an rst module.
     *
     * param item: tree item
     * return: boolean, or null if we couldn't determine the answer
     */
    itemIsRst(item) {
        if (item.type === "SPHINX") {
            return true;
        }
        if (item.type === "MODULE") {
            return !!item.is_rst;
        }
        const moduleItem = this.getItemByLibpathAndVersion(item.modpath, item.version);
        if (moduleItem) {
            return !!moduleItem.is_rst;
        }
        // If we could not locate a module item, this should mean that the given item is
        // defined in an rst module, while those modules have been omitted from the tree model
        // due to "sphinx page lifting," i.e. the practice of listing sphinx pages instead
        // of the rst modules that define them. We try to confirm that this is the case.
        const pagepath = item.modpath + '._page';
        const pageItem = this.getItemByLibpathAndVersion(pagepath, item.version);
        if (pageItem?.type === "SPHINX") {
            return true;
        }
        return null;
    }

    rebuildContextMenu(treeNode) {
        const rootItem = this.getRootItemForTreeElement(treeNode.domNode);
        const repopathv = rootItem.name;
        const [repopath, version] = repopathv.split("@");
        const item = treeNode.item;
        const isWIP = (version === "WIP");
        const cm = this.contextMenu;
        const mgr = this;

        cm.destroyDescendants();

        const tsHome = dojo.domConstruct.create("div");
        ise.util.addTailSelector(tsHome, item.libpath.split('.'));
        cm.addChild(new dojo.PopupMenuItem({
            label: 'Copy libpath',
            popup: new dojo.ContentPane({
                class: 'popupCP',
                content: tsHome
            })
        }));

        cm.addChild(new dojo.MenuSeparator());

        let sourceLabel = `${isWIP ? "Edit" : "View"} Source`;
        if (item.type !== "MODULE") {
            sourceLabel = `<span class="lrMenuItem"><span>${sourceLabel}</span><span class="menuHint">Alt-Double-Click</span></span>`;
        }
        cm.addChild(new dojo.MenuItem({
            label: sourceLabel,
            onClick: function (evt) {
                mgr.openItem({item, version, source: true});
            }
        }));

        if (item.type !== "MODULE") {
            // If not a module, then can be opened.
            cm.addChild(new dojo.MenuItem({
                label: '<span class="lrMenuItem"><span>Open</span><span class="menuHint">Double-Click</span></span>',
                onClick: function(evt){
                    mgr.openItem({item, version, source: false});
                }
            }));
            if (item.type === "CHART" && item.depth === 0) {
                // It's a TLD.
                cm.addChild(new dojo.MenuSeparator());
                cm.addChild(new dojo.MenuItem({
                    label: 'Upper theory map',
                    onClick: function(){
                        mgr.hub.contentManager.openContentInActiveTC({
                            type: "THEORYMAP",
                            theorymap: {
                                deducpath: item.libpath,
                                type: 'upper',
                                version: version,
                            }
                        });
                    }
                }));
                cm.addChild(new dojo.MenuItem({
                    label: 'Lower theory map',
                    onClick: function(){
                        mgr.hub.contentManager.openContentInActiveTC({
                            type: "THEORYMAP",
                            theorymap: {
                                deducpath: item.libpath,
                                type: 'lower',
                                version: version,
                            }
                        });
                    }
                }));
            }
            if (item.type === "CHART" || item.type === "NOTES") {
                cm.addChild(new dojo.MenuSeparator());
                this.addOpenStudyPageOption(cm, item.libpath, version);
            }
        } else {
            // The item does represent a module.
            cm.addChild(new dojo.MenuSeparator());
            this.addOpenStudyPageOption(cm, item.libpath, version);
            if (isWIP) {
                cm.addChild(new dojo.MenuSeparator());
                cm.addChild(new dojo.MenuItem({
                    label: "Build",
                    onClick: function(evt){
                        mgr.hub.editManager.build({
                            // Q: Should a build request on a module other than root add this module
                            // as a "forced re-read"?
                            buildpaths: [repopath],
                            makecleans: [false]
                        });
                    }
                }));
                cm.addChild(new dojo.MenuItem({
                    label: "Build Clean",
                    onClick: function(evt){
                        mgr.hub.editManager.build({
                            buildpaths: [repopath],
                            makecleans: [true]
                        });
                    }
                }));
            }
            if (item.libpath === repopath) {
                // It's the repo itself.
                cm.addChild(new dojo.MenuSeparator());
                // Repo options
                cm.addChild(new dojo.MenuItem({
                    label: "Refresh",
                    onClick: function(evt){
                        mgr.hub.repoManager.reloadBuildTree(repopathv);
                    }
                }));
                cm.addChild(new dojo.MenuItem({
                    label: "Close",
                    onClick: function(evt){
                        mgr.hub.repoManager.closeRepo(repopath, version);
                    }
                }));
            }
        }

        if (ise.util.libpathIsRemote(item.libpath)) {
            let modpath = item.libpath;
            let sourceRow = null;
            let modIsTerm;
            if (item.type === "MODULE") {
                modIsTerm = item.isTerminal;
            } else {
                // Any item in the structure tree that is not a module, must be an entity
                // defined within (and at the top level of) a module.
                modpath = item.modpath;
                sourceRow = item.sourceRow;
                const parentItem = treeNode.tree.model.store.get(item.parent);
                modIsTerm = parentItem.isTerminal;
            }
            const url = ise.util.libpath2remoteHostPageUrl(modpath, version, false, sourceRow, modIsTerm);
            const host = modpath.startsWith('gh.') ? 'GitHub' : 'BitBucket';
            cm.addChild(new dojo.MenuSeparator());
            cm.addChild(new dojo.MenuItem({
                label: `<span title="${url} (opens in new tab)">View at ${host}</span>`,
                onClick: function(){
                    ise.util.openInNewTab(url);
                }
            }));
        }

    }

    addOpenStudyPageOption(menu, libpath, version) {
        const hub = this.hub;
        menu.addChild(new dojo.MenuItem({
            label: 'Open study page',
            onClick: function(){
                hub.contentManager.openContentInActiveTC({
                    type: "NOTES",
                    libpath: `special.studypage.${libpath}.studyPage`,
                    version: version,
                });
            }
        }));
    }

    /* Given the libpath and version of any item in a repo,
     * retrieve the root item for that tree.
     */
    getRootItemForMemberLibpathAndVersion(libpath, version) {
        const repopath = ise.util.getRepoPart(libpath);
        const treeUid = ise.util.lv(repopath, version);
        const store = this.stores.get(treeUid);
        return store.query({id: repopath})[0];
    }

    /* Retrieve a tree item by its libpath and version.
     *
     * return: the tree item, or undefined if could not be found
     */
    getItemByLibpathAndVersion(libpath, version) {
        const repopath = ise.util.getRepoPart(libpath);
        const treeUid = ise.util.lv(repopath, version);
        const store = this.stores.get(treeUid);
        return store?.query({id: libpath})[0];
    }

    /* Get all descendants of a given item in a given tree.
     *
     * @param libpath: the libpath of the item in question
     * @param version: the version of the item in question
     * @return: array of items
     */
    getAllDescendantsByLibpathAndVersion(libpath, version) {
        const repopath = ise.util.getRepoPart(libpath);
        const treeUid = ise.util.lv(repopath, version);
        return this.getAllDescendants(treeUid, libpath);
    }

}
