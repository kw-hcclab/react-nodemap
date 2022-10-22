import React, { Component } from "react";
import PropTypes from "prop-types";
import domtoimage from "dom-to-image";
import { jsPDF } from "jspdf";

import { flextree } from "d3-flextree";
import * as d3 from "../../js/d3";
import JSONData from "../../js/JSONData";
import History from "../../js/History";
import { ReactComponent as trashcan } from "../../img/trashcan.svg";
import "./index.scss";

import { HiOutlineTrash } from "react-icons/hi";

class MindMap extends Component {
  constructor(props) {
    super(props);
    this.state = {
      toRecord: true, // 判断是否需要记录mmdata的数据快照
      toUpdate: true, // 判断是否需要更新mmdata
      dTop: {}, // mmdata에서 세로 좌표가 가장 높은 데이터
      mmdata: {}, // 思维导图数据
      root: {}, // 包含位置信息的mmdata
      showNodeContextMenu: false,
      contextMenuX: 0,
      contextMenuY: 0,
      nodeContextMenuItems: [{ title: "删除节点", command: 0 }],
      mindmap_svg: {},
      mindmap_g: {},
      dummy: {},
      trash_svg: {},
      mindmapSvgZoom: () => {},
      trash_mindmapSvgZoom: () => {},
      easePolyInOut: d3.transition().duration(1000).ease(d3.easePolyInOut),
      link: d3
        .linkHorizontal()
        .x((d) => d[0])
        .y((d) => d[1]),
      zoom: d3.zoom(),
      history: new History(),
      selectedElement: null,
      loading: false,
      sequence: 0,
    };
    this.mindmapRef = React.createRef();
    this.svgRef = React.createRef();
    this.contentRef = React.createRef();
    this.trashRef = React.createRef();
    this.dummyRef = React.createRef();
    this.menuRef = React.createRef();
    this.gpsRef = React.createRef();
    this.fitViewRef = React.createRef();
    this.downloadRef = React.createRef();
    this.undoRef = React.createRef();
    this.redoRef = React.createRef();
  }

  reposition = async () => {
    try {
      await this.makeCenter();
      await this.fitContent();
    } catch (e) {
      console.log(e);
    }
  };

  componentDidMount() {
    this.init();
    // this.mindmap_svg.on('mousedown', this.rightDragStart)
    // this.mindmap_svg.on('mousemove', this.rightDrag)
    // this.mindmap_svg.on('mouseup', this.rightDragEnd)
    this.updateData();
    this.reposition();

    this.state.mindmap_g.style("opacity", 1);
    this.state.trash_svg.style("opacity", 1);
    this.forceUpdate();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.value !== prevProps.value) {
      if (this.state.toUpdate) {
        const newData = new JSONData(this.props.value.data);
        // this.state.mmdata = newData;
        this.setState({
          mmdata: newData,
        });
        this.depthTraverse2(newData.data, this.getTextSize);
      } else {
        // this.state.toUpdate = true;
        this.setState({
          toUpdate: true,
        });
      }
    }
    if (this.state.mmdata !== prevState.mmdata) {
      this.updateData();
    }
    if (this.props.keyboard !== prevProps.keyboard) {
      this.makeKeyboard(this.props.keyboard);
    }
  }

  // methods
  updateData = () => {
    if (this.state.mmdata.data) {
      if (this.state.toRecord) {
        this.state.history.record(this.state.mmdata.data);
      }
      this.updateMindmap();
      this.state.toUpdate = false;
    }
  };

  init = () => {
    //바인딩 요소
    //전체
    this.state.mindmap_svg = d3.select(this.svgRef.current);
    // 마인드맵
    this.state.mindmap_g = d3
      .select(this.contentRef.current)
      .style("opacity", 0);
    this.state.trash_svg = d3.select(this.trashRef.current).style("opacity", 0);
    this.state.dummy = d3.select(this.dummyRef.current);
    // this.setState({
    //   mindmap_svg: d3.select(this.refs.svg),
    //   mindmap_g: d3.select(this.refs.content).style('opacity', 0),
    //   dummy: d3.select(this.refs.dummy)
    // }, () => {

    // })
    //바인딩 이벤트
    this.makeKeyboard(this.props.keyboard);
    this.state.mindmap_svg.on("contextmenu", () => {
      d3.event.preventDefault();
    });
    this.state.mindmapSvgZoom = this.state.zoom
      .scaleExtent([0.1, 8])
      .on("zoom", () => {
        this.state.mindmap_g.attr("transform", d3.event.transform);
      });
    // this.state.trash_mindmapSvgZoom = this.state.trash_zoom
    //   .scaleExtent([0.1, 8])
    //   .on("zoom", () => {
    //     this.state.trash.attr("transform", d3.event.transform);
    //   });
    // this.setState({
    //   mindmapSvgZoom: this.state.zoom.scaleExtent([0.1, 8]).on('zoom', () => {
    //     this.state.mindmap_g.attr('transform', d3.event.transform)
    //   })
    // })
    this.makeZoom(this.props.zoomable);
  };

  initNodeEvent = () => {
    // 绑定节点事件
    this.makeDrag(this.props.draggable);
    this.makeNodeAdd(this.props.showNodeAdd);
    this.makeContextMenu(this.props.contextMenu);
    this.makeNodeClick(this.props.nodeClick);
  };

  canUndo = () => {
    return this.state.history.canUndo;
  };

  canRedo = () => {
    return this.state.history.canRedo;
  };

  // 사건
  makeKeyboard = (val) => {
    this.state.mindmap_svg.on("keydown", val ? this.svgKeyDown : null);
  };

  makeNodeAdd = (val) => {
    const fObject = this.state.mindmap_g.selectAll("foreignObject");
    // const gBtn = this.state.mindmap_g.selectAll(".gButton");

    if (val) {
      // const { mouseLeave, mouseEnter, gBtnClick } = this;
      const { mouseLeave, mouseEnter } = this;

      fObject.on("mouseenter", mouseEnter).on("mouseleave", mouseLeave);
      // gBtn
      //   .on("mouseenter", mouseEnter)
      //   .on("mouseleave", mouseLeave)
      //   .on("click", gBtnClick);
    } else {
      fObject.on("mouseenter", null).on("mouseleave", null);
      // gBtn.on("mouseenter", null).on("mouseleave", null).on("click", null);
    }
  };

  makeContextMenu = (val) => {
    this.state.mindmap_g
      .selectAll("foreignObject")
      .on("contextmenu", val ? this.fObjectRightClick : null);
  };

  makeDrag = (val) => {
    const { mindmap_g } = this.state;
    if (val) {
      const { dragged, dragended } = this;
      mindmap_g
        .selectAll("foreignObject")
        .filter((d) => d.depth !== 0) // 非根节点才可以拖拽
        .call(
          d3
            .drag()
            .container((d, i, n) => n[i].parentNode.parentNode)
            .on("drag", dragged)
            .on("end", dragended)
        );
    } else {
      mindmap_g
        .selectAll("foreignObject")
        .call(d3.drag().on("drag", null).on("end", null));
    }
  };

  makeNodeClick = (val) => {
    this.state.mindmap_g
      .selectAll("foreignObject")
      .on("click", val ? this.fObjectClick : null);
  };

  makeZoom = (val) => {
    const { mindmap_svg, mindmapSvgZoom } = this.state;
    const { trash_svg, trash_mindmapSvgZoom } = this.state;
    if (val) {
      mindmap_svg.call(mindmapSvgZoom).on("dblclick.zoom", null);
      trash_svg.call(trash_mindmapSvgZoom).on("dblclick.zoom", null);
    } else {
      mindmap_svg.on(".zoom", null);
      trash_svg.on(".zoom", null);
    }
  };

  // button事件
  undo = () => {
    const prev = this.state.history.undo();
    // this.state.toRecord = false;
    // this.state.mmdata = new JSONData(prev);
    this.setState({
      toRecord: false,
      mmdata: new JSONData(prev),
    });
  };

  redo = () => {
    const next = this.state.history.redo();
    this.setState({
      toRecord: false,
      mmdata: new JSONData(next),
    });
  };

  exportImage() {
    // 导出png：待解决
  }

  makeCenter = async () => {
    // 가운데정렬
    await d3
      .transition()
      .end()
      .then(() => {
        if (this.contentRef.current) {
          console.log("마인드맵의 전체 세부구조", this.contentRef.current);
          const div = this.mindmapRef.current;
          // console.log("trash", this.trashRef.current);
          const content = this.contentRef.current.getBBox();
          const { k } = d3.zoomTransform(this.svgRef.current);
          const x = -(div.offsetWidth - k * content.width) / (2 * k) - 5;
          const y =
            -(div.offsetHeight - k * content.height) / (2 * k) -
            (-this.state.dTop.x - this.foreignY(this.state.dTop));

          // const trash_y =
          //   -(div.offsetHeight - k * content.height) / (2 * k) +
          //   (-this.state.dTop.x - this.foreignY(this.state.dTop));
          this.state.mindmap_svg.call(this.state.zoom.translateTo, x, y, [
            0,
            0,
          ]);
          this.state.mindmap_g.call(this.state.zoom.translateTo, 500, 100, [
            0,
            50,
          ]);
        }
      });
  };

  fitContent = async () => {
    // 창 크기에 맞게 조정
    await d3
      .transition()
      .end()
      .then(() => {
        if (this.contentRef.current) {
          const rect = this.contentRef.current.getBBox(); //위치정보와 너비정보 저장됨: SVGRect {x: -5, y: -318, width: 480, height: 567}
          const div = this.mindmapRef.current; //mindmapRef 전체 코드 접근
          const multipleX = div.offsetWidth / rect.width;
          const multipleY = div.offsetHeight / rect.height;
          const multiple = Math.min(multipleX, multipleY) * 0.95;

          this.state.mindmap_svg
            .transition(this.state.easePolyInOut)
            .call(this.state.zoom.scaleTo, multiple);
        }
      });
  };

  // 数据操作
  add = async (dParent, d) => {
    this.state.toRecord = true;

    const newData = new JSONData(this.state.mmdata.data);
    newData.add(dParent, d);
    this.depthTraverse2(newData.data, this.getTextSize);
    this.setState({
      mmdata: newData,
    });
    this.props.change(newData.getPuredata(undefined, this.props.fields));
  };

  insert = async (dPosition, d, i = 0) => {
    this.state.toRecord = true;

    const newData = new JSONData(this.state.mmdata.data);
    newData.insert(dPosition, d, i);
    this.depthTraverse2(newData.data, this.getTextSize);
    this.setState({
      mmdata: newData,
    });
    this.props.change(newData.getPuredata(undefined, this.props.fields));
  };

  del = async (s) => {
    if (this.state.selectedElement) {
      this.state.selectedElement.remove(); // 使动画流畅
    }

    this.state.toRecord = true;

    const newData = new JSONData(this.state.mmdata.data);
    newData.del(s);

    this.depthTraverse2(newData.data, this.getTextSize);
    this.setState({
      mmdata: newData,
    });
    this.props.change(newData.getPuredata(undefined, this.props.fields));
  };

  updateName = (d, name) => {
    this.state.toRecord = true;
    const newData = new JSONData(this.state.mmdata.data);
    newData.update(d.data, name);

    this.depthTraverse2(newData.data, this.getTextSize);
    this.setState({
      mmdata: newData,
    });
    this.props.change(newData.getPuredata(undefined, this.props.fields));
  };

  // 右键拖拽
  rightDragStart() {}

  rightDrag() {}

  rightDragEnd() {}

  // 键盘
  svgKeyDown() {
    const sele = d3.select("#selectedNode");
    if (!sele.node()) {
      return;
    }

    const seleData = sele.data()[0];
    const seleRawData = sele.data()[0].data;
    const pNode = sele.node().parentNode;
    const newJSON = { name: "新建节点", children: [] };
    const keyName = d3.event.key;

    if (keyName === "Tab") {
      // 添加子节点
      d3.event.preventDefault();
      this.add(seleRawData, newJSON);
      this.editNew(newJSON, seleData.depth + 1, pNode);
    } else if (keyName === "Enter") {
      // 添加弟弟节点
      d3.event.preventDefault();
      if (pNode.isSameNode(this.contentRef.current)) {
        this.add(seleRawData, newJSON); // 根节点enter时，等效tab
        this.editNew(newJSON, seleData.depth + 1, pNode);
      } else {
        this.insert(seleRawData, newJSON, 1);
        this.editNew(newJSON, seleData.depth, pNode);
      }
    } else if (keyName === "Backspace") {
      // 删除节点
      d3.event.preventDefault();
      this.del(seleRawData);
    }
  }

  divKeyDown = () => {
    if (d3.event.key === "Enter") {
      // d3.event.preventDefault()
      // document.execCommand('insertHTML', false, '<br>')
    }
  };

  // 노드 조작
  updateNodeName = () => {
    // 텍스트 편집이 완료되면
    const editP = document.querySelector("#editing > foreignObject > div");
    window.getSelection().removeAllRanges(); // 선택 해제
    const editText = editP.innerText;
    d3.select("g#editing").each((d, i, n) => {
      n[i].removeAttribute("id");
      editP.setAttribute("contenteditable", false);
      this.updateName(d, editText);
    });
  };

  removeSelectedNode = () => {
    const sele = this.state.selectedElement;
    if (sele) {
      sele.removeAttribute("id");
    }
  };

  selectNode = (n) => {
    // 选中节点
    if (n.getAttribute("id") !== "selectedNode") {
      this.removeSelectedNode();
      d3.select(n).attr("id", "selectedNode");
      this.state.selectedElement = n;
      // this.setState({
      //   selectedElement: n
      // })
    }
  };

  editNode = (n) => {
    // 编辑节点
    this.removeSelectedNode();
    n.setAttribute("id", "editing");
    d3.select(n)
      .selectAll("foreignObject")
      .filter((a, b, c) => c[b].parentNode === n)
      .select("div")
      .attr("contenteditable", true);

    const fdiv = document.querySelector("#editing > foreignObject > div");
    window.getSelection().selectAllChildren(fdiv);
  };

  editNew = (newJSON, depth, pNode) => {
    // 새 노드의 초점 맞추기
    d3.transition()
      .end()
      .then(
        () => {
          const clickedNode = d3
            .select(pNode)
            .selectAll(`g.node.depth_${depth}`)
            .filter((b) => b.data === newJSON)
            .node();

          this.editNode(clickedNode);
        },
        (err) => {
          console.log(err);
        }
      );
  };

  fdivMouseDown = () => {
    const flag = d3.event.target.getAttribute("contenteditable");
    if (flag === "true") {
      d3.event.stopPropagation(); // 防止触发drag、click
    }
  };

  fObjectClick = (d, i, n) => {
    const edit = document.getElementById("editing");
    const sele = document.getElementById("selectedNode");
    const clickedNode = n[i].parentNode;

    if (!edit) {
      // 편집 중이 아님
      this.selectNode(clickedNode);

      const fdiv = d3
        .select(clickedNode)
        .selectAll("foreignObject")
        .filter((a, b, c) => c[b].parentNode === clickedNode)
        .select("div")
        .node();
      fdiv.contentEditable = true;

      new Promise((resolve) => {
        setTimeout(() => {
          let flag = false; // 单击false 双击true
          if (document.activeElement !== fdiv) {
            fdiv.contentEditable = false;
          } else {
            flag = true;
            this.removeSelectedNode();
            clickedNode.setAttribute("id", "editing");
          }
          resolve(flag);
        }, 150);
      }).then((flag) => {
        if (!flag && clickedNode.isSameNode(sele)) {
          // 편집에 들어가기
          this.editNode(clickedNode);
        }
      });
    }
  };

  fObjectRightClick = (d, i, n) => {
    const sele = document.getElementById("selectedNode");
    const edit = document.getElementById("editing");
    const clickedNode = n[i].parentNode;
    if (clickedNode.isSameNode(edit)) {
      // 편집 중
      return;
    }
    if (!clickedNode.isSameNode(sele)) {
      // 선택
      this.selectNode(clickedNode);
    }
    // 오른쪽 버튼 메뉴 보이기
    const svgPosition = this.state.mindmap_svg.node().getBoundingClientRect();
    this.setState({
      contextMenuX: d3.event.pageX - svgPosition.x - window.scrollX,
      contextMenuY: d3.event.pageY - svgPosition.y - window.scrollY,
      showNodeContextMenu: true,
    });

    this.clearSelection();
    setTimeout(() => {
      this.menuRef.current.focus();
    }, 300);
  };

  // gBtnClick = (a, i, n) => {
  //   // 添加子节点
  //   if (n[i].style.opacity === "1") {
  //     const newJSON = {
  //       name: "新建节点",
  //       children: [],
  //     };

  //     const d = d3.select(n[i].parentNode).data()[0];
  //     this.add(d.data, newJSON);
  //     this.mouseLeave(null, i, n);
  //     this.editNew(newJSON, d.depth + 1, n[i].parentNode);
  //   }
  // };

  clickNodeMenu = (item) => {
    this.setState({
      showNodeContextMenu: false,
    });
    this.removeSelectedNode();
    if (item.command === 0) {
      // 删除节点
      this.del(this.state.selectedElement.__data__.data);
    }
  };

  clickMenu = async (item) => {
    this.removeSelectedNode();
    if (item.command === "01") {
      // 导出图片
      const exportName = this.props.title ? `${this.props.title}` : "export";
      await this.reposition();
      setTimeout(() => {
        const node = document.getElementById("mindmap");
        domtoimage.toPng(node).then((dataUrl) => {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          context.canvas.width = node.offsetWidth;
          context.canvas.height = node.offsetHeight;
          context.fillStyle = "white";
          context.fillRect(0, 0, canvas.width, canvas.height);

          // load image from data url
          const imageObj = new Image();
          imageObj.onload = () => {
            context.drawImage(imageObj, 0, 0, canvas.width, canvas.height);
            const watermark = this.props.exportWatermark;
            if (watermark) {
              const img = new Image();
              img.onload = function () {
                context.translate(canvas.width / 2, canvas.height / 2);
                context.rotate(watermark.rotate);
                context.drawImage(img, -this.width / 2, -this.height / 2);
                context.rotate(-watermark.rotate);
                context.translate(-canvas.width / 2, -canvas.height / 2);

                const link = document.createElement("a");
                link.download = `${exportName}.jpg`;
                link.href = canvas.toDataURL();
                link.click();
              };
              img.src = watermark.imgSrc;
            }
          };
          imageObj.src = dataUrl;
        });
      }, 400);
    } else if (item.command === "02") {
      // 导出PDF
      const exportName = this.props.title ? `${this.props.title}` : "export";
      await this.reposition();
      setTimeout(() => {
        domtoimage
          .toJpeg(document.getElementById("mindmap"))
          .then((dataUrl) => {
            const pdf = new jsPDF({ orientation: "landscape", unit: "pt" });
            const imgProps = pdf.getImageProperties(dataUrl);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(dataUrl, 0, 0, pdfWidth, pdfHeight);
            if (this.props.exportWatermark) {
              const watermark = this.props.exportWatermark;
              const img = new Image();
              img.onload = function () {
                pdf.addImage({
                  imageData: img,
                  format: watermark.format,
                  x: pdfWidth / 2 - this.width / 2,
                  y: pdfHeight / 2 - this.height / 2,
                  rotation: watermark.rotation,
                });
                pdf.save(`${exportName}.pdf`);
              };
              img.src = watermark.imgSrc;
            } else {
              pdf.save(`${exportName}.pdf`);
            }
          });
      }, 400);
    }
  };

  // 悬浮事件
  mouseLeave = (d, i, n) => {
    if (n[i].className.baseVal.includes("gButton")) {
      d3.select(n[i]).style("opacity", 0);
    } else {
      d3.selectAll("g.gButton")
        .filter((a, b, c) => c[b].parentNode === n[i].parentNode)
        .style("opacity", 0);
    }
  };

  mouseEnter = (d, i, n) => {
    let depthInRange = true;
    if (this.props.depthLimit) {
      depthInRange = this.props.depthLimit && d.depth < this.props.depthLimit;
    }
    const peersInRange = d.data.children.length < 10;
    if (depthInRange && peersInRange) {
      if (n[i].className.baseVal.includes("gButton")) {
        d3.select(n[i]).style("opacity", 1);
      } else {
        d3.selectAll("g.gButton")
          .filter((a, b, c) => c[b].parentNode === n[i].parentNode)
          .style("opacity", 0.5);
      }
    }
  };

  // 拖拽
  draggedNodeRenew = (draggedNode, targetX, targetY, dura = 0) => {
    const { link } = this.state;
    const { xSpacing } = this.props;
    const tran = d3.transition().duration(dura).ease(d3.easePoly);
    d3.select(draggedNode)
      .transition(tran)
      .attr("transform", `translate(${targetY},${targetX})`);
    // 更新draggedNode与父节点的path
    d3.select(draggedNode).each((d) => {
      d3.select(`path#path_${d.data.nodeId}`)
        .transition(tran)
        .attr(
          "d",
          `${link({
            source: [
              -targetY + (d.parent ? d.parent.data.size[1] : 0) - xSpacing,
              -targetX + (d.parent ? d.parent.data.size[0] / 2 : 0),
            ],
            target: [0, d.data.size[0] / 2],
          })}L${d.data.size[1] - xSpacing},${d.data.size[0] / 2}`
        );
    });
  };

  draggedNodeChildrenRenew = (d, px, py) => {
    const { draggedNodeChildrenRenew } = this;
    d.px = px;
    d.py = py;
    if (d.children) {
      for (let index = 0; index < d.children.length; index += 1) {
        const dChild = d.children[index];
        draggedNodeChildrenRenew(dChild, px, py);
      }
    }
  };

  dragged = (a, i, n) => {
    // 拖拽中【待完善】
    const { xSpacing } = this.props;
    const { mindmap_g } = this.state;
    const { draggedNodeChildrenRenew, draggedNodeRenew } = this;
    const draggedNode = n[i].parentNode;
    const fObject = n[i];
    // 选中
    const sele = document.getElementById("selectedNode");
    if (sele && !sele.isSameNode(draggedNode)) {
      sele.removeAttribute("id");
    }
    // 拖拽
    // 相对a原本位置的偏移
    const py = d3.event.x - a.x; // x轴偏移的量
    const px = d3.event.y - a.y; // y轴偏移的量
    draggedNodeChildrenRenew(a, px, py);
    // 相对a.parent位置的坐标
    let targetY = a.dy + py; // x轴坐标
    let targetX = a.dx + px; // y轴坐标
    draggedNodeRenew(draggedNode, targetX, targetY);
    // foreignObject偏移
    targetY += parseInt(fObject.getAttribute("x"), 10);
    targetX += parseInt(fObject.getAttribute("y"), 10);

    // a.parent 위치에 대한 others의 좌표를 계산하다
    // 마인드맵 ~
    mindmap_g
      .selectAll("g.node")
      .filter(
        (d, i, n) =>
          !draggedNode.isSameNode(n[i]) &&
          !draggedNode.parentNode.isSameNode(n[i])
      )
      .each((d, i, n) => {
        const gNode = n[i];
        const gRect = gNode.getElementsByTagName("foreignObject")[0];
        const rect = {
          // a.parent에 대한 다른 gRect의 좌표 및 gRect의 너비
          y:
            parseInt(gRect.getAttribute("x"), 10) + // foreignObject의 x축 오프셋
            d.y +
            (d.py ? d.py : 0) -
            (a.parent ? a.parent.y : 0),
          x:
            parseInt(gRect.getAttribute("y"), 10) + // foreignObject의 y축 오프셋
            d.x +
            (d.px ? d.px : 0) -
            (a.parent ? a.parent.x : 0),
          width: d.size[1] - xSpacing,
          height: d.size[0],
        };
        // 重叠触发矩形边框
        if (
          targetY > rect.y &&
          targetY < rect.y + rect.width &&
          targetX > rect.x &&
          targetX < rect.x + rect.height
        ) {
          if (
            !this.props.depthLimit ||
            (this.props.depthLimit && d.depth < this.props.depthLimit)
          ) {
            gNode.setAttribute("id", "newParentNode");
          }
        } else if (gNode.getAttribute("id") === "newParentNode") {
          gNode.removeAttribute("id");
        }
      });
  };

  dragback = (subject, draggedNode) => {
    const { draggedNodeChildrenRenew, draggedNodeRenew } = this;
    draggedNodeChildrenRenew(subject, 0, 0);
    draggedNodeRenew(draggedNode, subject.dx, subject.dy, 1000);
  };

  dragended = (d, i, n) => {
    const { root } = this.state;
    const { dragback } = this;
    const { subject } = d3.event;
    const draggedNode = n[i].parentNode;
    let draggedParentNode = draggedNode.parentNode;
    if (draggedParentNode.isEqualNode(this.contentRef.current)) {
      // 拖拽的是根节点时复原
      dragback(subject, draggedNode);
      return;
    }
    const newParentNode = document.getElementById("newParentNode");
    if (newParentNode) {
      // 建立新的父子关系
      newParentNode.removeAttribute("id");

      d3.select(draggedNode).each((draggedD) => {
        d3.select(newParentNode).each((newParentD) => {
          // 处理数据
          draggedNode.remove();
          this.del(draggedD.data);
        });
      });
      d3.select(draggedNode).each((draggedD) => {
        d3.select(newParentNode).each((newParentD) => {
          this.add(newParentD.data, draggedD.data);
        });
      });
      return;
    }
    if (Math.abs(subject.px) < root.nodeHeight) {
      // 이동 거리가 형제 노드 순서를 바꿀 만큼 충분하지 않을 때 복원
      dragback(subject, draggedNode);
      return;
    }
    // 형제 노드 순서 바꾸기
    draggedParentNode = d3.select(draggedParentNode);
    draggedParentNode.each((d) => {
      const draggedBrotherNodes = draggedParentNode
        .selectAll(`g.depth_${d.depth + 1}`)
        .filter((a, i, n) => !draggedNode.isSameNode(n[i]));
      if (!draggedBrotherNodes.nodes()[0]) {
        // 형제 노드가 없을 때 복원
        dragback(subject, draggedNode);
        return;
      }
      const a = { x0: Infinity, x1: -Infinity };
      draggedBrotherNodes.each((b, i, n) => {
        if (b.x > subject.x && b.x > a.x1 && b.x < subject.x + subject.px) {
          // 新哥哥节点
          a.x1 = b.x;
          a.b1 = b.data;
          a.n1 = n[i];
        }
        if (b.x < subject.x && b.x < a.x0 && b.x > subject.x + subject.px) {
          // 新弟弟节点
          a.x0 = b.x;
          a.b0 = b.data;
          a.n0 = n[i];
        }
      });
      if (a.b0 || a.b1) {
        // 存在新兄弟节点时调换节点顺序
        this.del(subject.data);
        if (a.b0) {
          // 插入在兄弟节点前面
          this.insert(a.b0, subject.data);
          if (draggedNode.parentNode) {
            draggedNode.parentNode.insertBefore(draggedNode, a.n0);
          }
        } else if (a.b1) {
          // 插入在兄弟节点后面
          this.insert(a.b1, subject.data, 1);
          if (draggedNode.parentNode) {
            draggedNode.parentNode.insertBefore(draggedNode, a.n1.nextSibling);
          }
        }
      } else {
        dragback(subject, draggedNode);
      }
    });
  };

  // 제작
  updateMindmap = () => {
    this.tree();
    this.getDTop();
    this.draw();
    this.initNodeEvent();
  };

  gClass = (d) => {
    return `depth_${d.depth} node`;
  };

  gTransform = (d) => {
    // node1 절반은 왼쪽에 배치
    // 홀수는 왼쪽에 배치?
    //nodeId 가 0, 00, 01, 000. 001,002
    console.log(
      "d.data.nodeId.length",
      d.data.nodeId.length,
      "d.data.nodeId[1] % 2",
      d.data.nodeId[1] % 2
    );

    // return `translate(${d.dy},${d.dx})`;
    if (d.data.nodeId === "0") {
      return `translate(${d.dy},${d.dx})`;
    } else {
      if (d.data.nodeId.length == 2) {
        if (d.data.nodeId[1] % 2 != 0) {
          // depth 1일때, 내 노드id가 홀수면 +
          return `translate(${d.dy},${d.dx})`;
        }
        // else {
        //   // depth 1일때, 내 노드id가 짝수면 -
        // 아무 값도 설정하지 않으면 왼쪽으로 이동함
        //   return `translate(${-d.dy},${-d.dx})`;
        // }
      }
    }
    // else if (d.data.nodeId.length == 3) {
    //   if (d.parent.data.nodeId[1] % 2 == 0) {
    //     // depth 2일때, 내 부모노드id가 홀수면 +
    //     return `translate(${d.dy},${d.dx})`;
    //   } else {
    //     // depth 2일때, 내 부모노드id가 짝수면 -
    //     return `translate(${-d.dy},${d.dx})`;
    //   }
    // }
    //  else {
    //   // return `translate(${d.dy},${d.dx})`;
    //   console.log(
    //     "내 노드",
    //     d.data.nodeId,
    //     "부모 노드",
    //     d.parent.data.nodeId
    //   );
    // }

    // if (this.state.sequence % 2 == 0) {
    //   this.setState({ sequence: this.state.sequence + 1 }, () => {
    //     console.log("짝", this.state.sequence % 2);
    //     return `translate(${d.dy},${d.dx})`;
    //   });
    // } else {
    //   this.setState({ sequence: this.state.sequence + 1 }, () => {
    //     console.log("홀", this.state.sequence % 2);
    //     return `translate(${d.dy},${d.dx})`;
    //   });
    // }
  };

  foreignY = (d) => {
    return -d.data.size[0] / 2 - 5;
  };

  // gBtnTransform = (d) => {
  //   return `translate(${d.data.size[1] + 8 - this.props.xSpacing},${
  //     d.data.size[0] / 2 - 12
  //   })`;
  // };

  pathId = (d) => {
    return `path_${d.data.nodeId}`;
  };

  pathClass = (d) => {
    return `depth_${d.depth}`;
  };

  pathColor = (d) => {
    // path 색 정하기
    // return "#bdbbbb"
    return d.data.color;
  };

  path = (d) => {
    return `${this.state.link({
      // source:[가로좌표, 세로좌표]
      source: [
        (d.parent ? d.parent.y + d.parent.data.size[1] : 0) -
          d.y -
          this.props.xSpacing, // 가로 좌표
        (d.parent ? d.parent.x + d.parent.data.size[0] / 2 : 0) - d.x, // 세로 좌표
      ],
      target: [0, d.data.size[0] / 2], //평평하게
    })}L${d.data.size[1] - this.props.xSpacing},${d.data.size[0] / 2}`;
  };

  nest = (d, i, n) => {
    const dd = d.children;
    if (dd) {
      d3.select(n[i])
        .selectAll(`g${dd[0] ? `.depth_${dd[0].depth}.node` : ""}`)
        .data(dd)
        .join(
          (enter) => this.appendNode(enter),
          (update) => this.updateNode(update),
          (exit) => this.exitNode(exit)
        );
    }
  };

  appendNode = (enter) => {
    const {
      gClass,
      gTransform,
      updateNodeName,
      divKeyDown,
      foreignY,
      gBtnTransform,
      pathId,
      pathClass,
      pathColor,
      path,
      nest,
      fdivMouseDown,
    } = this;

    // 여기! g만드는 곳"
    const gNode = enter.append("g");
    gNode.attr("class", gClass).attr("transform", gTransform);

    const foreign = gNode // 마인드맵 선에서 어느 위치에 있을 것인지
      .append("foreignObject")
      .attr("x", -5)
      .attr("y", foreignY);
    const foreignDiv = foreign
      .append("xhtml:div")
      .attr("contenteditable", false)
      .text((d) => d.data.name);
    // 노드 텍스트 편집
    // foreignDiv
    //   .on("blur", updateNodeName)
    //   .on("keydown", divKeyDown)
    //   .on("mousedown", fdivMouseDown);
    foreignDiv.each((d, i, n) => {
      // eslint-disable-next-line no-undef
      const observer = new ResizeObserver((l) => {
        const t = l[0].target;
        const b1 = window.getComputedStyle(t).borderTopWidth;
        const b2 = window.getComputedStyle(t.parentNode).borderTopWidth;
        let spacing = parseInt(b1, 10) + parseInt(b2, 10);
        spacing = spacing || 0;
        foreign
          .filter((d, index) => i === index)
          .attr("width", l[0].contentRect.width + spacing * 2) // div和foreign border
          .attr("height", l[0].contentRect.height + spacing * 2);
      });
      observer.observe(n[i]);
    });
    // gButton 만들기
    // const gBtn = gNode
    //   .append("g")
    //   .attr("class", "gButton")
    //   .attr("transform", gBtnTransform);
    // gBtn
    //   .append("rect")
    //   .attr("width", 24)
    //   .attr("height", 24)
    //   .attr("rx", 3)
    //   .attr("ry", 3);
    // gBtn.append("path").attr("d", "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z");

    const enterData = enter.data();
    if (enterData.length) {
      if (enterData[0].data.nodeId !== "0") {
        gNode
          .append("path")
          .attr("id", pathId)
          .attr("class", pathClass)
          .lower()
          .attr("stroke", pathColor)
          .attr("d", path);
      } else if (enterData[0].data.nodeId === "0") {
        // 루트 노드
        foreign.attr("y", (d) => foreignY(d) + d.size[0] / 2);
      }

      gNode.each(nest);
    }

    // gBtn.raise();
    foreign.raise();
    return gNode;
  };

  updateNode = (update) => {
    const {
      gClass,
      gTransform,
      foreignY,
      gBtnTransform,
      pathId,
      pathClass,
      pathColor,
      path,
      nest,
    } = this;
    const { easePolyInOut } = this.state;
    update.interrupt().selectAll("*").interrupt();
    update
      .attr("class", gClass)
      .transition(easePolyInOut)
      .attr("transform", gTransform);

    update.each((d, i, n) => {
      const node = d3.select(n[i]);
      const foreign = node
        .selectAll("foreignObject")
        .filter((d, i, n) => n[i].parentNode === node.node())
        .data((d) => [d]) // must rebind the children using selection.data to give them the new data.
        .attr(
          "y",
          d.data.nodeId !== "0" ? foreignY(d) : foreignY(d) + d.size[0] / 2
        );

      foreign.select("div").text(d.data.name);
      node
        .select("path")
        .filter((d, i, n) => n[i].parentNode === node.node())
        .attr("id", pathId(d))
        .attr("class", pathClass(d))
        .attr("stroke", pathColor(d))
        .transition(easePolyInOut)
        .attr("d", path(d));

      node.each(nest);

      // node
      //   .selectAll("g.gButton")
      //   .filter((d, i, n) => n[i].parentNode === node.node())
      //   .attr("transform", gBtnTransform(d))
      //   .raise();
    });
    return update;
  };

  exitNode = (exit) => {
    exit.filter((d, i, n) => n[i].classList[0] !== "gButton").remove();
  };

  draw = () => {
    // svg생성
    const { mindmap_g } = this.state;
    const { appendNode, updateNode, exitNode } = this;
    const d = [this.state.root];

    // 마인드맵 그리기 시작
    mindmap_g
      .selectAll(`g${d[0] ? `.depth_${d[0].depth}.node` : ""}`)
      .data(d)
      .join(
        (enter) => appendNode(enter),
        (update) => updateNode(update),
        (exit) => exitNode(exit)
      );
  };

  tree = () => {
    // 데이터 처리
    const { mmdata } = this.state;
    const { ySpacing } = this.props;

    const layout = flextree({ spacing: ySpacing });

    const t = layout.hierarchy(mmdata.data[0]);

    layout(t);

    t.each((a) => {
      // x 세로축 y 가로축
      // 상대편향
      a.dx = a.x - (a.parent ? a.parent.x : 0);
      a.dy = a.y - (a.parent ? a.parent.y : 0);
      a.dx = a.x - (a.parent ? a.parent.x : 0);

      if (!a.children) {
        a.children = [];
      }
    });
    this.state.root = t;
    this.forceUpdate();
  };

  getDTop = () => {
    let t = this.state.root;

    while (t.children[0]) {
      t = t.children[0];
    }
    this.state.dTop = t;
    this.forceUpdate();
  };

  getTextSize = (t) => {
    const { dummy } = this.state;
    const { xSpacing } = this.props;
    let textWidth = 0;
    let textHeight = 0;
    dummy
      .selectAll(".dummyText")
      .data([t.name])
      .enter()
      .append("div")
      .text((d) => d)
      .each((d, i, n) => {
        textWidth = n[i].offsetWidth;
        textHeight = n[i].offsetHeight;
        n[i].remove(); // remove them just after displaying them
      });
    t.size = [textHeight, textWidth + xSpacing];
  };

  clearSelection = () => {
    // 오른쪽 단추로 눌렀을 때 선택한 단어 지우기
    if (document.selection && document.selection.empty) {
      document.selection.empty();
    } else if (window.getSelection) {
      const sel = window.getSelection();
      sel.removeAllRanges();
    }
  };

  depthTraverse2 = (d, func) => {
    // 깊이, func 각 요소
    for (let index = 0; index < d.length; index++) {
      const dChild = d[index];
      func(dChild);
      if (dChild.children) {
        this.depthTraverse2(dChild.children, func);
      }
    }
  };

  render() {
    const mmStyle = {
      width:
        this.props.style && this.props.style.width
          ? this.props.style.width
          : "100%",
      height:
        this.props.style && this.props.style.height
          ? this.props.style.height
          : "100vh",
      cursor: this.state.loading ? "wait" : "pointer",
    };

    const svgClass = `stroke-width-${this.props.strokeWidth}`;
    return (
      <div
        ref={this.mindmapRef}
        id="mindmap"
        // SVG를 세로로 배치하는 것 부터!
        // style={[mmStyle, (display = "flex")]}
        style={mmStyle}
        // onContextMenu={(e) => {
        //   if (!this.state.showNodeContextMenu) {
        //     this.clearSelection();
        //     e.preventDefault();

        //     contextMenu.show({
        //       id: "menu",
        //       event: e,
        //       props: {
        //         width: 70,
        //       },
        //     });
        //   }
        // }}
      >
        <svg ref={this.svgRef} className={svgClass} tabIndex="0">
          {/* 어떻게 해야 위 아래로 배치되고.....  */}
          {/* <HiOutlineTrash ref={this.trashRef} color="black" size="30" /> */}
          {/* <g ref={this.trashRef}></g> */}
          <g ref={this.contentRef}>
            {/* <src src="./bin.png" ref={this.trashRef} alt="bin" /> */}
            {/* <HiOutlineTrash
              id="trash"
              ref={this.trashRef}
              color="black"
              size="50"
            /> */}
            {/* <g id="content">
            
            </g> */}
          </g>
        </svg>
        <div ref={this.dummyRef} id="dummy" />
        {/* <ContextMenu
          id="menu"
          onClick={this.clickMenu}
          loading={() => {
            this.setState({
              loading: true,
            });
          }}
          stopLoading={() => {
            this.setState({
              loading: false,
            });
          }}
        /> */}
        {this.state.showNodeContextMenu && (
          <div
            ref={this.menuRef}
            id="menu"
            tabIndex="0"
            style={{
              top: this.state.contextMenuY + "px",
              left: this.state.contextMenuX + "px",
            }}
            onBlur={() => {
              this.setState({
                showNodeContextMenu: false,
              });
            }}
          >
            {/* {this.state.nodeContextMenuItems.map((item, index) => (
              <div
                className="menu-item"
                key={index}
                onClick={() => {
                  this.clickNodeMenu(item);
                }}
              >
                {item.title}
              </div>
            ))} */}
          </div>
        )}
        {/* <div className="button right-bottom">
          {this.props.gps && (
            <button
              className="icon"
              ref={this.gpsRef}
              type="button"
              onClick={this.makeCenter}
            >
              <i className="gps" />
            </button>
          )}
          {this.props.fitView && (
            <button
              className="icon"
              ref={this.fitViewRef}
              type="button"
              onClick={this.fitContent}
            >
              <i className="fitView" />
            </button>
          )}
          {this.props.download && (
            <button
              className="icon"
              ref={this.downloadRef}
              type="button"
              onClick={this.exportImage}
            >
              <i className="download" />
            </button>
          )}
        </div> */}
        {/* <div className="button top-right">
          {this.props.showUndo && (
            <button
              className="icon"
              ref={this.undoRef}
              type="button"
              disabled={!this.canUndo()}
              onClick={this.canUndo() ? this.undo : null}
            >
              <i className="undo" />
            </button>
          )}
          {this.props.showUndo && (
            <button
              className="icon"
              ref={this.redoRef}
              type="button"
              disabled={!this.canRedo()}
              onClick={this.canRedo() ? this.redo : null}
            >
              <i className="redo" />
            </button>
          )}
        </div> */}
      </div>
    );
  }
}

MindMap.propTypes = {
  // value: PropTypes.array,
  width: PropTypes.number,
  height: PropTypes.number,
  xSpacing: PropTypes.number,
  ySpacing: PropTypes.number,
  strokeWidth: PropTypes.number,
  draggable: PropTypes.bool,
  gps: PropTypes.bool,
  fitView: PropTypes.bool,
  download: PropTypes.bool,
  keyboard: PropTypes.bool,
  showNodeAdd: PropTypes.bool,
  contextMenu: PropTypes.bool,
  nodeClick: PropTypes.bool,
  zoomable: PropTypes.bool,
  showUndo: PropTypes.bool,
};

MindMap.defaultProps = {
  xSpacing: 80,
  ySpacing: 20,
  strokeWidth: 4,
  draggable: true,
  gps: true,
  fitView: false,
  download: false,
  keyboard: true,
  showNodeAdd: true,
  contextMenu: true,
  nodeClick: true,
  zoomable: true,
  showUndo: true,
};

export default MindMap;
