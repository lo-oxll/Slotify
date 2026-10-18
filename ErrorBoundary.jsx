import { Component } from "react";
import { report } from "./monitor";

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { report(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-10 text-center">
        <p>حدث خطأ غير متوقع.</p>
        <button className="btn mt-4" onClick={() => location.reload()}>إعادة المحاولة</button>
      </div>
    );
  }
}
